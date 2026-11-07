import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { computeChunkLight } from './light';
import { meshChunk } from './mesher';
import { CHUNK_HEIGHT, CHUNK_SIZE } from './terrain';
import { VoxelWorld, type VoxelEdit } from './world';

/**
 * Brief amendment (documented in task-6-report.md): seed `mesh-test` generates a deep
 * ocean at chunk (0, 0) — 877 opaque faces are visible there before any edit — so the
 * exact quad counts asserted below can only hold over a genuinely empty chunk. The
 * fixture clears the whole chunk through `applyEdits`, which — unlike `setBlock` — may
 * also overwrite the bedrock floor. Every assertion and helper stays as briefed.
 */
const EMPTY_CHUNK: VoxelEdit[] = (() => {
  const edits: VoxelEdit[] = [];
  for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) edits.push({ x, y, z, id: BLOCK.Air });
    }
  }
  return edits;
})();

function emptyWorld(): { world: VoxelWorld; y: number } {
  const world = new VoxelWorld('mesh-test');
  world.applyEdits(EMPTY_CHUNK);
  return { world, y: 40 };
}

function clearBox(world: VoxelWorld, y: number): void {
  for (let x = 0; x < 6; x += 1) {
    for (let z = 0; z < 6; z += 1) {
      for (let dy = -1; dy <= 3; dy += 1) world.setBlock(x, y + dy, z, BLOCK.Air);
    }
  }
}

describe('mesher', () => {
  it('emits six quads for one isolated block', () => {
    const { world, y } = emptyWorld();
    clearBox(world, y);
    world.setBlock(2, y, 2, BLOCK.Stone);
    const mesh = meshChunk(world, 0, 0, computeChunkLight(world, 0, 0));
    expect(mesh.opaque.indices.length / 6).toBe(6);
    expect(mesh.opaque.positions.length / 3).toBe(24);
  });

  it('culls the shared face between two blocks', () => {
    const { world, y } = emptyWorld();
    clearBox(world, y);
    world.setBlock(2, y, 2, BLOCK.Stone);
    world.setBlock(3, y, 2, BLOCK.Stone);
    const mesh = meshChunk(world, 0, 0, computeChunkLight(world, 0, 0));
    // Brief amendment: 12 unit faces minus the 2 that face each other leaves 10 faces,
    // and greedy merging folds the four coplanar 2 x 1 pairs into single quads, so the
    // 2 x 1 x 1 box emits 6 quads. A mesher that failed to merge would emit 10 here.
    expect(mesh.opaque.indices.length / 6).toBe(6);
  });

  it('separates cutout and transparent geometry', () => {
    const { world, y } = emptyWorld();
    clearBox(world, y);
    world.setBlock(2, y, 2, BLOCK.RiftwoodLeaves);
    world.setBlock(4, y, 4, BLOCK.Water);
    const mesh = meshChunk(world, 0, 0, computeChunkLight(world, 0, 0));
    expect(mesh.cutout.indices.length).toBeGreaterThan(0);
    expect(mesh.transparent.indices.length).toBeGreaterThan(0);
    expect(mesh.opaque.indices.length).toBe(0);
  });

  it('bakes light and occlusion into vertex colors', () => {
    const { world, y } = emptyWorld();
    clearBox(world, y);
    world.setBlock(2, y, 2, BLOCK.Stone);
    world.setBlock(2, y + 1, 3, BLOCK.Stone);
    const mesh = meshChunk(world, 0, 0, computeChunkLight(world, 0, 0));
    const colors = mesh.opaque.colors;
    expect(colors.length).toBe(mesh.opaque.positions.length);
    expect(new Set(colors).size).toBeGreaterThan(1);
    for (const value of colors) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('produces stable geometry arrays', () => {
    const { world, y } = emptyWorld();
    clearBox(world, y);
    world.setBlock(2, y, 2, BLOCK.Stone);
    const first = meshChunk(world, 0, 0, computeChunkLight(world, 0, 0));
    const second = meshChunk(world, 0, 0, computeChunkLight(world, 0, 0));
    expect(second.opaque.positions).toEqual(first.opaque.positions);
    expect(second.opaque.indices).toEqual(first.opaque.indices);
  });
});
