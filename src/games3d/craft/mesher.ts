import {
  BLOCK,
  blockSpec,
  isCutoutBlock,
  isLiquidBlock,
  isOpaqueBlock,
  type TextureKey,
} from './blocks';
import { combinedLight, type ChunkLight } from './light';
import { CHUNK_HEIGHT, CHUNK_SIZE } from './terrain';
import { tileFor } from './textures';
import type { VoxelWorld } from './world';

export interface MeshBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  /** Atlas tile index per vertex, paired with a block-unit uv that the shader wraps. */
  tiles: number[];
  colors: number[];
  indices: number[];
}

export interface ChunkMesh {
  opaque: MeshBuffers;
  cutout: MeshBuffers;
  transparent: MeshBuffers;
}

type Bucket = keyof ChunkMesh;

/** Widest / tallest rectangle a greedy pass may produce. */
const MAX_MERGE = 16;
/** Highest light level, matching `ChunkLight` channels. */
const MAX_LIGHT = 15;
/**
 * Cells in the largest face plane. A slice on the x or z axis spans 16 x 64, so the mask
 * is sized for the tallest plane even though horizontal slices only use 16 x 16.
 */
const MASK_CELLS = CHUNK_SIZE * CHUNK_HEIGHT;
/** Occlusion is 0-3, so three blockers reach the fully dark corner. */
const MAX_OCCLUSION = 3;
/** Ambient term that keeps unlit faces readable instead of pure black. */
const AMBIENT = 0.12;

/**
 * Face neighbourhood padding. One cell each side is enough to cull faces; two are needed
 * because an AO diagonal reaches a second cell away. Sampling is uniform, so the extra
 * ring is simply Air outside the world.
 */
const PAD = 2;
const PAD_SIDE = CHUNK_SIZE + PAD * 2;
const PAD_HEIGHT = CHUNK_HEIGHT + PAD * 2;
const PAD_LAYER = PAD_SIDE * PAD_SIDE;
const PAD_VOLUME = PAD_LAYER * PAD_HEIGHT;

/**
 * Quad corners in canonical (u, v) order: 0 = low/low, 1 = high/low, 2 = high/high,
 * 3 = low/high. Winding it this way makes the cross product point along +d (see
 * `emitQuad`), so the reversed order is the counter-clockwise order for `-d`.
 */
const QUAD_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const SAME_WINDING: readonly number[] = [0, 1, 2, 3];
const REVERSED_WINDING: readonly number[] = [0, 3, 2, 1];
/** Both face directions, outside first for readability; order only affects array order. */
const DIRECTIONS: readonly number[] = [1, -1];

/** Corner signs, in the canonical order used by both the mask and the AO pass. */
const CORNER_SIGNS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function createBuffers(): MeshBuffers {
  return { positions: [], normals: [], uvs: [], tiles: [], colors: [], indices: [] };
}

function paddedIndex(x: number, y: number, z: number): number {
  return (y + PAD) * PAD_LAYER + (z + PAD) * PAD_SIDE + (x + PAD);
}

function sample(blocks: Uint8Array, x: number, y: number, z: number): number {
  return blocks[paddedIndex(x, y, z)];
}

/** Samples one step along a single axis. */
function sampleAxis(
  blocks: Uint8Array,
  x: number,
  y: number,
  z: number,
  axis: number,
  amount: number,
): number {
  return sample(
    blocks,
    x + (axis === 0 ? amount : 0),
    y + (axis === 1 ? amount : 0),
    z + (axis === 2 ? amount : 0),
  );
}

/** Samples one diagonal step across two axes. */
function sampleCorner(
  blocks: Uint8Array,
  x: number,
  y: number,
  z: number,
  axisA: number,
  amountA: number,
  axisB: number,
  amountB: number,
): number {
  return sample(
    blocks,
    x + (axisA === 0 ? amountA : 0) + (axisB === 0 ? amountB : 0),
    y + (axisA === 1 ? amountA : 0) + (axisB === 1 ? amountB : 0),
    z + (axisA === 2 ? amountA : 0) + (axisB === 2 ? amountB : 0),
  );
}

/**
 * Copies the chunk plus a two-cell border through `world.getBlock`, so the hot loops
 * never resolve block specs or chunk coordinates per neighbour. `getBlock` is the only
 * world access, so the world is never mutated and the result is deterministic.
 */
function takeSnapshot(world: VoxelWorld, cx: number, cz: number): Uint8Array {
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const blocks = new Uint8Array(PAD_VOLUME);
  let index = 0;
  for (let y = -PAD; y < CHUNK_HEIGHT + PAD; y += 1) {
    for (let z = -PAD; z < CHUNK_SIZE + PAD; z += 1) {
      for (let x = -PAD; x < CHUNK_SIZE + PAD; x += 1) {
        blocks[index] = world.getBlock(originX + x, y, originZ + z);
        index += 1;
      }
    }
  }
  return blocks;
}

/** Texture for one face: the top for `+y`, the bottom for `-y`, the side otherwise. */
function faceTexture(id: number, d: number, dir: number): TextureKey {
  const textures = blockSpec(id).textures;
  if (d !== 1) return textures.side;
  return dir > 0 ? textures.top : textures.bottom;
}

/**
 * A face is visible when the neighbour does not hide it: opaque blocks always hide, and a
 * liquid is hidden by itself (no interior water faces). Cutout and transparent blocks
 * never hide a neighbour, so leaves and glass keep their inner faces.
 */
function isFaceVisible(id: number, neighbour: number): boolean {
  if (isOpaqueBlock(neighbour)) return false;
  if (isLiquidBlock(id)) return neighbour !== id;
  return true;
}

/**
 * Geometry bucket by block class: liquids (water and lava) and glass are transparent,
 * every other cutout block is cutout, everything else is opaque. Liquid and glass faces
 * carry the `water` and `glass` texture keys from their block specs.
 */
function bucketOf(id: number): Bucket {
  if (isLiquidBlock(id) || id === BLOCK.Glass) return 'transparent';
  if (isCutoutBlock(id)) return 'cutout';
  return 'opaque';
}

/**
 * Standard 0-3 corner occlusion: the two side neighbours and the diagonal one, where two
 * blocked sides shadow the corner completely. `x/y/z` is the neighbouring face cell.
 */
function cornerOcclusion(
  blocks: Uint8Array,
  x: number,
  y: number,
  z: number,
  u: number,
  v: number,
  signU: number,
  signV: number,
): number {
  const sideU = isOpaqueBlock(sampleAxis(blocks, x, y, z, u, signU));
  const sideV = isOpaqueBlock(sampleAxis(blocks, x, y, z, v, signV));
  if (sideU && sideV) return MAX_OCCLUSION;
  const diagonal = isOpaqueBlock(sampleCorner(blocks, x, y, z, u, signU, v, signV));
  return (sideU ? 1 : 0) + (sideV ? 1 : 0) + (diagonal ? 1 : 0);
}

/**
 * The subset of a mask entry the emitter consumes. A mask entry also carries its texture
 * key (`Mask.texture`), which takes part in the merge key; the emitter resolves it to an
 * atlas tile so one material can serve every block face.
 */
interface FaceEntry {
  id: number;
  light: number;
  tile: number;
  /** Per corner occlusion counts in canonical order. */
  occlusion: [number, number, number, number];
}

/**
 * Visibility mask for one slice: one entry per cell, stored as four parallel arrays
 * (id, light, four AO values, texture key) so the greedy pass can compare neighbours
 * without allocating. A zero id marks an empty slot.
 */
interface Mask {
  id: Int32Array;
  light: Uint8Array;
  occlusion: Uint8Array;
  texture: Array<TextureKey | null>;
}

interface SliceContext {
  blocks: Uint8Array;
  light: ChunkLight;
  mesh: ChunkMesh;
  mask: Mask;
  /** Axis the slice is stacked along, plus its two in-plane axes. */
  d: number;
  u: number;
  v: number;
  /** Plane extents along `u` and `v`: 64 when the axis is y, 16 otherwise. */
  sizeU: number;
  sizeV: number;
  /** +1 or -1: which side of the block the face looks at. */
  dir: number;
  /** Slice index along `d`. */
  slice: number;
}

function createMask(): Mask {
  return {
    id: new Int32Array(MASK_CELLS),
    light: new Uint8Array(MASK_CELLS),
    occlusion: new Uint8Array(MASK_CELLS * 4),
    texture: new Array<TextureKey | null>(MASK_CELLS).fill(null),
  };
}

function buildSliceMask(ctx: SliceContext): void {
  const { blocks, light, mask, d, u, v, sizeU, sizeV, dir, slice } = ctx;
  mask.id.fill(BLOCK.Air);
  mask.texture.fill(null);

  const cell = [0, 0, 0];
  const offset = [0, 0, 0];
  offset[d] = dir;

  for (let j = 0; j < sizeV; j += 1) {
    for (let i = 0; i < sizeU; i += 1) {
      cell[d] = slice;
      cell[u] = i;
      cell[v] = j;
      const id = sample(blocks, cell[0], cell[1], cell[2]);
      if (id === BLOCK.Air) continue;

      const x = cell[0];
      const y = cell[1];
      const z = cell[2];
      const neighbour = sample(blocks, x + offset[0], y + offset[1], z + offset[2]);
      if (!isFaceVisible(id, neighbour)) continue;

      const slot = j * sizeU + i;
      mask.id[slot] = id;
      // In-chunk only: `combinedLight` is 0 outside the chunk by contract.
      mask.light[slot] = combinedLight(light, x + offset[0], y + offset[1], z + offset[2]);
      mask.texture[slot] = faceTexture(id, d, dir);

      const nx = x + offset[0];
      const ny = y + offset[1];
      const nz = z + offset[2];
      const base = slot * 4;
      for (let corner = 0; corner < 4; corner += 1) {
        const [signU, signV] = CORNER_SIGNS[corner];
        mask.occlusion[base + corner] = cornerOcclusion(
          blocks,
          nx,
          ny,
          nz,
          u,
          v,
          signU,
          signV,
        );
      }
    }
  }
}

function slotMatches(mask: Mask, a: number, b: number): boolean {
  if (mask.id[a] === BLOCK.Air || mask.id[a] !== mask.id[b]) return false;
  if (mask.light[a] !== mask.light[b]) return false;
  if (mask.texture[a] !== mask.texture[b]) return false;
  const baseA = a * 4;
  const baseB = b * 4;
  return (
    mask.occlusion[baseA] === mask.occlusion[baseB]
    && mask.occlusion[baseA + 1] === mask.occlusion[baseB + 1]
    && mask.occlusion[baseA + 2] === mask.occlusion[baseB + 2]
    && mask.occlusion[baseA + 3] === mask.occlusion[baseB + 3]
  );
}

function readEntry(mask: Mask, slot: number): FaceEntry {
  const base = slot * 4;
  const texture = mask.texture[slot];
  return {
    id: mask.id[slot],
    light: mask.light[slot],
    tile: texture === null ? 0 : tileFor(texture),
    occlusion: [
      mask.occlusion[base],
      mask.occlusion[base + 1],
      mask.occlusion[base + 2],
      mask.occlusion[base + 3],
    ],
  };
}

/**
 * Emits one quad for a merged rectangle. `slice` is the block layer along `d`; the face
 * plane sits on the far side for `dir > 0` and on the near side for `dir < 0`.
 */
function emitQuad(
  target: MeshBuffers,
  entry: FaceEntry,
  d: number,
  dir: number,
  slice: number,
  i: number,
  j: number,
  width: number,
  height: number,
): void {
  const u = (d + 1) % 3;
  const v = (d + 2) % 3;
  const plane = slice + (dir > 0 ? 1 : 0);
  const brightness = AMBIENT + (1 - AMBIENT) * (entry.light / MAX_LIGHT);
  const normal = [0, 0, 0];
  normal[d] = dir;
  const winding = dir > 0 ? SAME_WINDING : REVERSED_WINDING;
  const start = target.positions.length / 3;

  for (const corner of winding) {
    const [signU, signV] = QUAD_CORNERS[corner];
    const position = [0, 0, 0];
    position[d] = plane;
    position[u] = i + signU * width;
    position[v] = j + signV * height;

    target.positions.push(position[0], position[1], position[2]);
    target.normals.push(normal[0], normal[1], normal[2]);
    target.uvs.push(signU * width, signV * height);
    target.tiles.push(entry.tile);

    const ao = 1 - entry.occlusion[corner] / MAX_OCCLUSION;
    const shade = brightness * ao;
    target.colors.push(shade, shade, shade);
  }

  target.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function mergeSlice(ctx: SliceContext): void {
  const { mask, mesh, d, dir, sizeU, sizeV, slice } = ctx;
  for (let j = 0; j < sizeV; j += 1) {
    for (let i = 0; i < sizeU; i += 1) {
      const slot = j * sizeU + i;
      if (mask.id[slot] === BLOCK.Air) continue;

      let width = 1;
      while (width < MAX_MERGE && i + width < sizeU && slotMatches(mask, slot, slot + width)) {
        width += 1;
      }

      let height = 1;
      grow: while (height < MAX_MERGE && j + height < sizeV) {
        const rowStart = (j + height) * sizeU + i;
        for (let offset = 0; offset < width; offset += 1) {
          if (!slotMatches(mask, slot, rowStart + offset)) break grow;
        }
        height += 1;
      }

      const entry = readEntry(mask, slot);
      emitQuad(mesh[bucketOf(entry.id)], entry, d, dir, slice, i, j, width, height);

      for (let dj = 0; dj < height; dj += 1) {
        const rowStart = (j + dj) * sizeU + i;
        for (let di = 0; di < width; di += 1) mask.id[rowStart + di] = BLOCK.Air;
      }
    }
  }
}

/**
 * Builds the three geometry buckets for one chunk. Faces are visited as slices on each
 * axis in both directions — 16 x 16 horizontal slices, 16 x 64 vertical ones — greedy-merged
 * when id, light, AO and texture agree, and routed by block class. Light is baked from the
 * supplied chunk light; every output array is filled in a fixed iteration order, so equal
 * inputs give equal arrays.
 */
export function meshChunk(
  world: VoxelWorld,
  cx: number,
  cz: number,
  light: ChunkLight,
): ChunkMesh {
  const mesh: ChunkMesh = {
    opaque: createBuffers(),
    cutout: createBuffers(),
    transparent: createBuffers(),
  };
  const ctx: SliceContext = {
    blocks: takeSnapshot(world, cx, cz),
    light,
    mesh,
    mask: createMask(),
    d: 0,
    u: 1,
    v: 2,
    sizeU: CHUNK_HEIGHT,
    sizeV: CHUNK_SIZE,
    dir: 1,
    slice: 0,
  };

  for (ctx.d = 0; ctx.d < 3; ctx.d += 1) {
    ctx.u = (ctx.d + 1) % 3;
    ctx.v = (ctx.d + 2) % 3;
    ctx.sizeU = ctx.u === 1 ? CHUNK_HEIGHT : CHUNK_SIZE;
    ctx.sizeV = ctx.v === 1 ? CHUNK_HEIGHT : CHUNK_SIZE;
    const depth = ctx.d === 1 ? CHUNK_HEIGHT : CHUNK_SIZE;
    for (const dir of DIRECTIONS) {
      ctx.dir = dir;
      for (ctx.slice = 0; ctx.slice < depth; ctx.slice += 1) {
        buildSliceMask(ctx);
        mergeSlice(ctx);
      }
    }
  }

  return mesh;
}
