import { describe, expect, it } from 'vitest';
import { BLOCK, type BlockId } from './blocks';
import { computeChunkLight } from './light';
import { meshChunk, type ChunkMesh, type MeshBuffers } from './mesher';
import { VoxelWorld } from './world';

/**
 * The fixture never clears the chunk. `applyEdits` now refuses Bedrock replacements
 * (audit C-02), and a whole-chunk wipe would still normalize the invariant the directive
 * forbids. Test blocks float at y = 58, above the generated ocean and above the tree
 * envelope for this seed, and every count is bounded to the block's own box so terrain
 * geometry cannot contribute.
 */
const FLOAT_Y = 58;

function floated(): VoxelWorld {
  return new VoxelWorld('mesh-test');
}

function place(world: VoxelWorld, x: number, y: number, z: number, id: BlockId): void {
  expect(world.getBlock(x, y, z)).toBe(BLOCK.Air);
  expect(world.setBlock(x, y, z, id)).toBe(true);
}

function meshOf(world: VoxelWorld): ChunkMesh {
  return meshChunk(world, 0, 0, computeChunkLight(world, 0, 0));
}

function quads(buffers: MeshBuffers): number {
  return buffers.indices.length / 6;
}

/**
 * One emitted quad is six indices over four unique vertices. Reading the indices rather
 * than assuming consecutive vertex groups also catches an index regression instead of
 * silently miscounting.
 */
function* quadsOf(buffers: MeshBuffers): Generator<readonly number[]> {
  for (let index = 0; index < buffers.indices.length; index += 6) {
    yield [
      buffers.indices[index]!,
      buffers.indices[index + 1]!,
      buffers.indices[index + 2]!,
      buffers.indices[index + 5]!,
    ];
  }
}

type Box = readonly [number, number, number, number, number, number];

function vertexInside(buffers: MeshBuffers, vertex: number, [minX, minY, minZ, maxX, maxY, maxZ]: Box): boolean {
  const base = vertex * 3;
  return (
    buffers.positions[base]! >= minX
    && buffers.positions[base]! <= maxX
    && buffers.positions[base + 1]! >= minY
    && buffers.positions[base + 1]! <= maxY
    && buffers.positions[base + 2]! >= minZ
    && buffers.positions[base + 2]! <= maxZ
  );
}

function quadsInside(buffers: MeshBuffers, box: Box): number {
  let count = 0;
  for (const corners of quadsOf(buffers)) {
    if (corners.every((vertex) => vertexInside(buffers, vertex, box))) count += 1;
  }
  return count;
}

function coloursInside(buffers: MeshBuffers, box: Box): number[] {
  const found: number[] = [];
  for (const corners of quadsOf(buffers)) {
    if (!corners.every((vertex) => vertexInside(buffers, vertex, box))) continue;
    for (const vertex of corners) {
      const base = vertex * 3;
      found.push(buffers.colors[base]!, buffers.colors[base + 1]!, buffers.colors[base + 2]!);
    }
  }
  return found;
}

describe('mesher', () => {
  it('emits six quads for one isolated block', () => {
    const world = floated();
    place(world, 2, FLOAT_Y, 2, BLOCK.Stone);
    const mesh = meshOf(world);

    expect(quadsInside(mesh.opaque, [2, FLOAT_Y, 2, 3, FLOAT_Y + 1, 3])).toBe(6);
    expect(quads(mesh.opaque)).toBeGreaterThan(6);
    expect(world.getBlock(2, 0, 2)).toBe(BLOCK.Bedrock);
  });

  it('merges the coplanar faces of two adjacent blocks', () => {
    const world = floated();
    place(world, 2, FLOAT_Y, 2, BLOCK.Stone);
    place(world, 3, FLOAT_Y, 2, BLOCK.Stone);
    const mesh = meshOf(world);

    // Twelve unit faces minus the two that face each other leaves ten, and greedy
    // merging folds the four coplanar 2 x 1 pairs into single quads, so the 2 x 1 x 1
    // box emits six quads. A mesher that failed to merge would emit ten.
    expect(quadsInside(mesh.opaque, [2, FLOAT_Y, 2, 4, FLOAT_Y + 1, 3])).toBe(6);
  });

  it('separates cutout and transparent geometry', () => {
    const world = floated();
    place(world, 2, FLOAT_Y, 2, BLOCK.RiftwoodLeaves);
    place(world, 4, FLOAT_Y, 4, BLOCK.Water);
    const mesh = meshOf(world);

    expect(quadsInside(mesh.cutout, [2, FLOAT_Y, 2, 3, FLOAT_Y + 1, 3])).toBe(6);
    expect(quadsInside(mesh.transparent, [4, FLOAT_Y, 4, 5, FLOAT_Y + 1, 5])).toBe(6);
    expect(quadsInside(mesh.opaque, [2, FLOAT_Y, 2, 3, FLOAT_Y + 1, 3])).toBe(0);
    expect(quadsInside(mesh.opaque, [4, FLOAT_Y, 4, 5, FLOAT_Y + 1, 5])).toBe(0);
  });

  it('bakes occlusion into vertex colors', () => {
    const world = floated();
    place(world, 8, FLOAT_Y, 8, BLOCK.Stone);
    place(world, 8, FLOAT_Y + 1, 9, BLOCK.Stone);
    const mesh = meshOf(world);

    expect(mesh.opaque.colors.length).toBe(mesh.opaque.positions.length);
    for (const value of mesh.opaque.colors) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }

    // The upper block shades the corners of the lower one, so the baked values differ.
    const baked = coloursInside(mesh.opaque, [8, FLOAT_Y, 8, 9, FLOAT_Y + 2, 10]);
    expect(baked.length).toBeGreaterThan(0);
    expect(new Set(baked).size).toBeGreaterThan(1);
  });

  it('darkens geometry under a roof with the baked skylight', () => {
    const world = floated();
    for (let x = 0; x < 4; x += 1) {
      for (let z = 0; z < 4; z += 1) place(world, x, FLOAT_Y + 2, z, BLOCK.Stone);
    }
    place(world, 1, FLOAT_Y, 1, BLOCK.Stone);
    place(world, 6, FLOAT_Y, 6, BLOCK.Stone);
    const mesh = meshOf(world);
    const top = (x: number, z: number): number[] =>
      coloursInside(mesh.opaque, [x, FLOAT_Y + 1, z, x + 1, FLOAT_Y + 1, z + 1]);

    const shadowed = Math.max(...top(1, 1));
    const open = Math.max(...top(6, 6));

    expect(shadowed).toBeLessThan(open);
    expect(open).toBeCloseTo(1, 9);
  });

  it('produces stable geometry arrays', () => {
    const world = floated();
    place(world, 2, FLOAT_Y, 2, BLOCK.Stone);
    const first = meshOf(world);
    const second = meshOf(world);
    expect(second.opaque.positions).toEqual(first.opaque.positions);
    expect(second.opaque.indices).toEqual(first.opaque.indices);
  });
});