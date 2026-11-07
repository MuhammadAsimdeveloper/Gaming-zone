import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { VoxelWorld, chunkKey, worldToChunk } from './world';

function surface(world: VoxelWorld, x: number, z: number): number {
  for (let y = 63; y > 0; y -= 1) {
    if (world.getBlock(x, y, z) !== BLOCK.Air && world.getBlock(x, y, z) !== BLOCK.Water) return y;
  }
  return 0;
}

describe('VoxelWorld', () => {
  it('converts world coordinates to chunk coordinates', () => {
    expect(worldToChunk(0, 0)).toEqual({ cx: 0, cz: 0 });
    expect(worldToChunk(15, 15)).toEqual({ cx: 0, cz: 0 });
    expect(worldToChunk(16, -1)).toEqual({ cx: 1, cz: -1 });
    expect(chunkKey(-2, 3)).toBe('-2,3');
  });

  it('reads generated blocks and treats outside height as air', () => {
    const world = new VoxelWorld('world-test');
    expect(world.getBlock(0, 0, 0)).toBe(BLOCK.Bedrock);
    expect(world.getBlock(0, -1, 0)).toBe(BLOCK.Air);
    expect(world.getBlock(0, 64, 0)).toBe(BLOCK.Air);
  });

  it('writes and reads blocks across chunk borders', () => {
    const world = new VoxelWorld('world-test');
    const y = surface(world, 15, 0) + 1;
    expect(world.setBlock(15, y, 0, BLOCK.Gilded)).toBe(true);
    expect(world.setBlock(16, y, 0, BLOCK.Glass)).toBe(true);
    expect(world.getBlock(15, y, 0)).toBe(BLOCK.Gilded);
    expect(world.getBlock(16, y, 0)).toBe(BLOCK.Glass);
    expect(world.setBlock(15, y, 0, BLOCK.Gilded)).toBe(false);
  });

  it('marks the containing chunk dirty and neighbours at borders', () => {
    const world = new VoxelWorld('world-test');
    world.takeDirtyChunks();
    const y = surface(world, 15, 0) + 1;
    world.setBlock(15, y, 0, BLOCK.Planks);
    const dirty = world.takeDirtyChunks().map((chunk) => chunkKey(chunk.cx, chunk.cz)).sort();
    expect(dirty).toEqual(['0,0', '1,0']);
    expect(world.takeDirtyChunks()).toHaveLength(0);
  });

  it('keeps edits after a chunk is unloaded and regenerated', () => {
    const world = new VoxelWorld('world-test');
    const y = surface(world, 3, 3) + 2;
    world.setBlock(3, y, 3, BLOCK.Lantern);
    world.unloadChunk(0, 0);
    expect(world.getChunk(0, 0)).toBeUndefined();
    expect(world.getBlock(3, y, 3)).toBe(BLOCK.Lantern);
  });

  it('round-trips edits through save data', () => {
    const world = new VoxelWorld('world-test');
    const y = surface(world, 5, 5) + 2;
    world.setBlock(5, y, 5, BLOCK.Bricks);
    world.setBlock(5, y + 1, 5, BLOCK.Torch);
    const edits = world.editsForSave();
    const restored = new VoxelWorld('world-test');
    restored.applyEdits(edits);
    expect(restored.getBlock(5, y, 5)).toBe(BLOCK.Bricks);
    expect(restored.getBlock(5, y + 1, 5)).toBe(BLOCK.Torch);
    expect(restored.editsForSave()).toEqual(edits);
  });
});

describe('VoxelWorld edit validation', () => {
  type Edit = Parameters<VoxelWorld['applyEdits']>[0][number];

  it('rejects fractional coordinates in setBlock without writing or saving', () => {
    const world = new VoxelWorld('world-test');
    const reference = new VoxelWorld('world-test');

    expect(world.setBlock(5, 40.5, 5, BLOCK.Bricks)).toBe(false);
    expect(world.setBlock(2.5, 40, 2, BLOCK.Bricks)).toBe(false);
    expect(world.setBlock(2, 40, 2.5, BLOCK.Bricks)).toBe(false);
    expect(world.editsForSave()).toEqual([]);
    expect(world.ensureChunk(0, 0).blocks).toEqual(reference.ensureChunk(0, 0).blocks);
  });

  it('rejects NaN coordinates in setBlock without writing or saving', () => {
    const world = new VoxelWorld('world-test');
    const reference = new VoxelWorld('world-test');

    expect(world.setBlock(Number.NaN, 40, 5, BLOCK.Bricks)).toBe(false);
    expect(world.setBlock(5, 40, Number.NaN, BLOCK.Bricks)).toBe(false);
    expect(world.editsForSave()).toEqual([]);
    expect(world.ensureChunk(0, 0).blocks).toEqual(reference.ensureChunk(0, 0).blocks);
  });

  it('skips malformed edits in applyEdits without throwing or dirtying save data', () => {
    const world = new VoxelWorld('world-test');
    const malformed = [
      { id: BLOCK.Bricks },
      null,
      undefined,
      { x: null, y: null, z: null, id: BLOCK.Bricks },
      { x: 1.5, y: 40, z: 2, id: BLOCK.Bricks },
      { x: 3, y: 40.5, z: 3, id: BLOCK.Bricks },
      { x: 3, y: 40, z: 3.25, id: BLOCK.Bricks },
      { x: Number.NaN, y: 40, z: Number.NaN, id: BLOCK.Bricks },
      { x: 3, y: 40, z: 3, id: 9999 },
    ] as unknown as Edit[];

    expect(() => world.applyEdits(malformed)).not.toThrow();
    expect(world.editsForSave()).toEqual([]);
    expect(world.getChunk(0, 0)).toBeUndefined();
    expect(world.getBlock(0, 0, 0)).toBe(BLOCK.Bedrock);
  });

  it('writes edits into cached chunks and dirties cached border neighbours', () => {
    const world = new VoxelWorld('world-test');
    world.ensureChunk(0, 0);
    world.ensureChunk(1, 0);
    world.takeDirtyChunks();

    world.applyEdits([{ x: 15, y: 40, z: 5, id: BLOCK.Bricks }]);

    expect(world.getChunk(0, 0)).toBeDefined();
    expect(world.getBlock(15, 40, 5)).toBe(BLOCK.Bricks);
    expect(world.getChunk(0, 0)?.dirty).toBe(true);
    expect(world.getChunk(1, 0)?.dirty).toBe(true);
    const dirty = world.takeDirtyChunks().map((chunk) => chunkKey(chunk.cx, chunk.cz)).sort();
    expect(dirty).toEqual(['0,0', '1,0']);

    world.unloadChunk(0, 0);
    expect(world.getChunk(0, 0)).toBeUndefined();
    expect(world.getBlock(15, 40, 5)).toBe(BLOCK.Bricks);
    expect(world.editsForSave()).toEqual([{ x: 15, y: 40, z: 5, id: BLOCK.Bricks }]);
  });

  it('refuses saved edits that replace generated bedrock', () => {
    const world = new VoxelWorld('world-test');
    const reference = new VoxelWorld('world-test');

    world.applyEdits([{ x: 0, y: 0, z: 0, id: BLOCK.Air }]);

    expect(world.getBlock(0, 0, 0)).toBe(BLOCK.Bedrock);
    expect(world.editsForSave()).toEqual([]);
    expect(world.ensureChunk(0, 0).blocks).toEqual(reference.ensureChunk(0, 0).blocks);
  });

  it('keeps bedrock placed by an earlier edit when a later save clears it', () => {
    const world = new VoxelWorld('world-test');
    expect(world.setBlock(2, 10, 2, BLOCK.Bedrock)).toBe(true);
    world.unloadChunk(0, 0);

    world.applyEdits([{ x: 2, y: 10, z: 2, id: BLOCK.Air }]);

    expect(world.getBlock(2, 10, 2)).toBe(BLOCK.Bedrock);
    expect(world.editsForSave()).toEqual([{ x: 2, y: 10, z: 2, id: BLOCK.Bedrock }]);
  });

  it('keeps cached bedrock when a save clears it', () => {
    const world = new VoxelWorld('world-test');
    world.ensureChunk(0, 0);
    world.takeDirtyChunks();

    world.applyEdits([{ x: 4, y: 0, z: 4, id: BLOCK.Air }]);

    expect(world.getBlock(4, 0, 4)).toBe(BLOCK.Bedrock);
    expect(world.getChunk(0, 0)?.dirty).toBe(false);
    expect(world.editsForSave()).toEqual([]);
  });
});
