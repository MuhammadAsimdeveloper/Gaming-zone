import { isOpaqueBlock, lightOf } from './blocks';
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex } from './terrain';
import type { VoxelWorld } from './world';

export interface ChunkLight {
  sky: Uint8Array;
  block: Uint8Array;
}

/** Maximum light level, which is also how many falloff steps a source can reach. */
const MAX_LEVEL = 15;
/** One whole chunk of padding on each horizontal side, which covers any 15-block radius. */
const PAD = CHUNK_SIZE;
/** Padded edge length in blocks (3 chunks). */
const PAD_SIZE = CHUNK_SIZE * 3;
/** Cells in one padded horizontal plane. */
const COLUMN = PAD_SIZE * PAD_SIZE;
/** Cells in the padded 3 x 3 chunk volume. */
const VOLUME = COLUMN * CHUNK_HEIGHT;
/** Cells in one returned chunk. */
const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

/**
 * Copies the 3 x 3 chunk neighbourhood of the target chunk into one flat array.
 * Only reads through `world.getBlock`, so the world is never mutated.
 */
function takeSnapshot(world: VoxelWorld, cx: number, cz: number): Uint8Array {
  const originX = cx * CHUNK_SIZE - PAD;
  const originZ = cz * CHUNK_SIZE - PAD;
  const blocks = new Uint8Array(VOLUME);
  let index = 0;
  for (let py = 0; py < CHUNK_HEIGHT; py += 1) {
    for (let pz = 0; pz < PAD_SIZE; pz += 1) {
      const z = originZ + pz;
      for (let px = 0; px < PAD_SIZE; px += 1) {
        blocks[index] = world.getBlock(originX + px, py, z);
        index += 1;
      }
    }
  }
  return blocks;
}

/** Precomputes opacity so the hot loops never resolve block specs per neighbour. */
function takeOpacity(blocks: Uint8Array): Uint8Array {
  const opaque = new Uint8Array(VOLUME);
  for (let index = 0; index < VOLUME; index += 1) {
    opaque[index] = isOpaqueBlock(blocks[index]) ? 1 : 0;
  }
  return opaque;
}

/** One bucket per light level: a descending sweep is a level-ordered BFS. */
function makeBuckets(): number[][] {
  const buckets: number[][] = [];
  for (let level = 0; level <= MAX_LEVEL; level += 1) buckets.push([]);
  return buckets;
}

/**
 * Seeds every cell that has no opaque block above it in its padded column. Water is
 * not opaque, so open water is exposed. Opaque cells stay dark.
 */
function seedSkylight(
  opaque: Uint8Array,
  grid: Uint8Array,
  buckets: number[][],
): void {
  const full = buckets[MAX_LEVEL];
  for (let pz = 0; pz < PAD_SIZE; pz += 1) {
    for (let px = 0; px < PAD_SIZE; px += 1) {
      const columnBase = pz * PAD_SIZE + px;
      let exposed = true;
      for (let py = CHUNK_HEIGHT - 1; py >= 0; py -= 1) {
        const index = py * COLUMN + columnBase;
        if (opaque[index]) {
          exposed = false;
        } else if (exposed) {
          grid[index] = MAX_LEVEL;
          full.push(index);
        }
      }
    }
  }
}

/** Seeds every emitting cell in the padded area with its emission value. */
function seedBlocklight(
  blocks: Uint8Array,
  opaque: Uint8Array,
  grid: Uint8Array,
  buckets: number[][],
): void {
  for (let index = 0; index < VOLUME; index += 1) {
    if (opaque[index]) continue;
    const emission = lightOf(blocks[index]);
    if (emission <= 0) continue;
    const level = emission > MAX_LEVEL ? MAX_LEVEL : emission;
    grid[index] = level;
    buckets[level].push(index);
  }
}

/**
 * Level-ordered BFS over the padded volume. Buckets are swept from 15 down to 1 and a
 * neighbour is claimed at push time, so processing order is non-increasing and every
 * cell is enqueued at most once per distinct level it attains. `maxSteps` is a hard
 * guard that exceeds every possible enqueue count, so it can never truncate propagation.
 *
 * Opaque cells never receive or conduct light. `keepFullDownward` is the skylight rule
 * that a downward move from level 15 through a transparent block keeps level 15.
 */
function propagate(
  grid: Uint8Array,
  opaque: Uint8Array,
  buckets: number[][],
  keepFullDownward: boolean,
  maxSteps: number,
): void {
  function relax(neighbour: number, value: number): void {
    if (value <= 0 || opaque[neighbour]) return;
    if (value <= grid[neighbour]) return;
    grid[neighbour] = value;
    buckets[value].push(neighbour);
  }

  let steps = 0;
  for (let level = MAX_LEVEL; level > 1; level -= 1) {
    const bucket = buckets[level];
    const falloff = level - 1;
    for (let cursor = 0; cursor < bucket.length; cursor += 1) {
      if (steps >= maxSteps) return;
      steps += 1;
      const index = bucket[cursor];
      if (grid[index] !== level) continue;

      const py = (index / COLUMN) | 0;
      const rest = index - py * COLUMN;
      const pz = (rest / PAD_SIZE) | 0;
      const px = rest - pz * PAD_SIZE;

      if (px > 0) relax(index - 1, falloff);
      if (px < PAD_SIZE - 1) relax(index + 1, falloff);
      if (pz > 0) relax(index - PAD_SIZE, falloff);
      if (pz < PAD_SIZE - 1) relax(index + PAD_SIZE, falloff);
      if (py < CHUNK_HEIGHT - 1) relax(index + COLUMN, falloff);
      if (py > 0) {
        relax(index - COLUMN, keepFullDownward && level === MAX_LEVEL ? MAX_LEVEL : falloff);
      }
    }
  }
}

/** Copies the target chunk out of the padded grid; iteration order matches `blockIndex`. */
function writeChunk(grid: Uint8Array, out: Uint8Array): void {
  let target = 0;
  for (let py = 0; py < CHUNK_HEIGHT; py += 1) {
    const rowBase = py * COLUMN + PAD * PAD_SIZE + PAD;
    for (let pz = 0; pz < CHUNK_SIZE; pz += 1) {
      const sourceBase = rowBase + pz * PAD_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
        out[target] = grid[sourceBase + lx];
        target += 1;
      }
    }
  }
}

/**
 * Computes skylight and blocklight for one chunk from a read-only 3 x 3 chunk
 * neighbourhood. The result is deterministic for a fixed world state.
 */
export function computeChunkLight(world: VoxelWorld, cx: number, cz: number): ChunkLight {
  const blocks = takeSnapshot(world, cx, cz);
  const opaque = takeOpacity(blocks);

  const grid = new Uint8Array(VOLUME);
  const skyBuckets = makeBuckets();
  seedSkylight(opaque, grid, skyBuckets);
  // Every sky seed sits at the maximum level, so each remaining cell is claimed at most
  // once: one pop per non-opaque cell bounds the sweep by the padded volume.
  propagate(grid, opaque, skyBuckets, true, VOLUME);
  const sky = new Uint8Array(CHUNK_VOLUME);
  writeChunk(grid, sky);

  grid.fill(0);
  const blockBuckets = makeBuckets();
  seedBlocklight(blocks, opaque, grid, blockBuckets);
  // Every emitter pops once as a seed and at most once more if a stronger source lights
  // it, so two pops per padded cell is a hard upper bound on the sweep.
  propagate(grid, opaque, blockBuckets, false, VOLUME * 2);
  const block = new Uint8Array(CHUNK_VOLUME);
  writeChunk(grid, block);

  return { sky, block };
}

/** Brightest channel at a chunk-local cell; 0 for anything outside the chunk. */
export function combinedLight(light: ChunkLight, lx: number, ly: number, lz: number): number {
  if (!Number.isInteger(lx) || !Number.isInteger(ly) || !Number.isInteger(lz)) return 0;
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return 0;
  if (ly < 0 || ly >= CHUNK_HEIGHT) return 0;
  const index = blockIndex(lx, ly, lz);
  return Math.max(light.sky[index], light.block[index]);
}
