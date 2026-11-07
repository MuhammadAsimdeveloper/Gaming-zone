import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { computeChunkLight } from './light';
import { meshChunk, type ChunkMesh, type MeshBuffers } from './mesher';
import { VoxelWorld } from './world';

/**
 * The fixture never clears the chunk: `applyEdits` accepts Bedrock replacements (audit
 * C-02), so a whole-chunk wipe would normalize exactly the invariant the directive
 * forbids. Test blocks float at y = 58, well above the generated ocean, and every count
 * is bounded to the block's own bounding box so terrain geometry cannot contribute.
 */
const FLOAT_Y = 58;

function floated(): VoxelWorld {
  return new VoxelWorld('mesh-test');
}

function meshOf(world: VoxelWorld): ChunkMesh {
  return meshChunk(world, 0, 0, computeChunkLight(world, 0, 0));
}

function quads(buffers: MeshBuffers): number {
  return buffers.indices.length / 6;
}

/**
 * Counts quads whose four corners all lie inside the box. Geometry is emitted as
 * consecutive groups of four vertices, so one quad is one group. Bounding the count to
 * the block under test keeps it stable even though placing a block changes skylight and
 * can split merged terrain faces elsewhere in the chunk.
 */
function quadsInside(
  buffers: MeshBuffers,
  min: [number, number, number],
  max: [number, number, number],
): number {
  let count = 0;
  for (let vertex = 0; vertex < buffers.positions.length / 3; vertex += 4) {
    let inside = true;
    for (let corner = 0; corner < 4; corner += 1) {
      const base = (vertex + corner) * 3;
      for (let axis = 0; axis < 3; axis += 1) {
        const value = buffers.positions[base + axis]!;
        if (value < min[axis]! || value > max[axis]!) inside = false;
      }
    }
    if (inside) count += 1;
  }
  return count;
}

/** Vertex groups of four belong to one quad, so their colours can be inspected per face. */
function coloursInside(mesh: ChunkMesh, min: [number, number, number], max: [number, number, number]): number[] {
  const found: number[] = [];
  for (const buffers of [mesh.opaque, mesh.cutout, mesh.transparent]) {
    for (let vertex = 0; vertex < buffers.positions.length / 3; vertex += 4) {
      let inside = true;
      for (let corner = 0; corner < 4; corner += 1) {
        const base = (vertex + corner) * 3;
        for (let axis = 0; axis < 3; axis += 1) {
          const value = buffers.positions[base + axis]!;
          if (value < min[axis]! || value > max[axis]!) inside = false;
        }
      }
      if (!inside) continue;
      for (let corner = 0; corner < 4; corner += 1) {
        const base = (vertex + corner) * 3;
        found.push(buffers.colors[base]!, buffers.colors[base + 1]!, buffers.colors[base + 2]!);
      }
    }
  }
  return found;
}

describe('mesher', () => {
  it('emits six quads for one isolated block', () => {
    const world = floated();
    world.setBlock(2, FLOAT_Y, 2, BLOCK.Stone);
    const mesh = meshOf(world);

    expect(quadsInside(mesh.opaque, [2, FLOAT_Y, 2], [3, FLOAT_Y + 1, 3])).toBe(6);
    expect(quads(mesh.opaque)).toBeGreaterThan(6);
  });

  it('merges the coplanar faces of two adjacent blocks', () => {
    const world = floated();
    world.setBlock(2, FLOAT_Y, 2, BLOCK.Stone);
    world.setBlock(3, FLOAT_Y, 2, BLOCK.Stone);
    const mesh = meshOf(world);

    // Twelve unit faces minus the two that face each other leaves ten, and greedy
    // merging folds the four coplanar 2 x 1 pairs into single quads, so the 2 x 1 x 1
    // box emits six quads. A mesher that failed to merge would emit ten.
    expect(quadsInside(mesh.opaque, [2, FLOAT_Y, 2], [4, FLOAT_Y + 1, 3])).toBe(6);
  });

  it('separates cutout and transparent geometry', () => {
    const world = floated();
    world.setBlock(2, FLOAT_Y, 2, BLOCK.RiftwoodLeaves);
    world.setBlock(4, FLOAT_Y, 4, BLOCK.Water);
    const mesh = meshOf(world);

    expect(quadsInside(mesh.cutout, [2, FLOAT_Y, 2], [3, FLOAT_Y + 1, 3])).toBe(6);
    expect(quadsInside(mesh.transparent, [4, FLOAT_Y, 4], [5, FLOAT_Y + 1, 5])).toBe(6);
    expect(quadsInside(mesh.opaque, [2, FLOAT_Y, 2], [3, FLOAT_Y + 1, 3])).toBe(0);
    expect(quadsInside(mesh.opaque, [4, FLOAT_Y, 4], [5, FLOAT_Y + 1, 5])).toBe(0);
  });

  it('bakes light and occlusion into vertex colors', () => {
    const world = floated();
    world.setBlock(2, FLOAT_Y, 2, BLOCK.Stone);
    world.setBlock(2, FLOAT_Y + 1, 3, BLOCK.Stone);
    const mesh = meshOf(world);
    const colors = mesh.opaque.colors;

    expect(colors.length).toBe(mesh.opaque.positions.length);
    for (const value of colors) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }

    // The floating pair is the only geometry in this box, and the upper block shades
    // the corners of the lower one, so the baked values must differ.
    const baked = coloursInside(mesh, [2, FLOAT_Y, 2], [3, FLOAT_Y + 2, 4]);
    expect(baked.length).toBeGreaterThan(0);
    expect(new Set(baked).size).toBeGreaterThan(1);
  });

  it('produces stable geometry arrays', () => {
    const world = floated();
    world.setBlock(2, FLOAT_Y, 2, BLOCK.Stone);
    const first = meshOf(world);
    const second = meshOf(world);
    expect(second.opaque.positions).toEqual(first.opaque.positions);
    expect(second.opaque.indices).toEqual(first.opaque.indices);
  });
});