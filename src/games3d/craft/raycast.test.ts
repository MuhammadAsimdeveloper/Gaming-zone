import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { raycastVoxel } from './raycast';
import { VoxelWorld } from './world';

function clearLine(world: VoxelWorld, y: number): void {
  for (let x = 0; x <= 8; x += 1) {
    world.setBlock(x, y, 0, BLOCK.Air);
    world.setBlock(x, y + 1, 0, BLOCK.Air);
  }
}

describe('raycastVoxel', () => {
  it('hits the near face of a block along +X with the correct normal', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(world, y);
    world.setBlock(5, y, 0, BLOCK.Stone);
    const hit = raycastVoxel(world, { x: 0.5, y: y + 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 10);
    expect(hit).not.toBeNull();
    expect([hit?.x, hit?.y, hit?.z]).toEqual([5, y, 0]);
    expect([hit?.nx, hit?.ny, hit?.nz]).toEqual([-1, 0, 0]);
    expect(hit?.distance).toBeCloseTo(4.5, 5);
  });

  it('returns null when the block is beyond reach', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(world, y);
    world.setBlock(5, y, 0, BLOCK.Stone);
    expect(raycastVoxel(world, { x: 0.5, y: y + 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 4)).toBeNull();
  });

  it('ignores water and lava', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(world, y);
    world.setBlock(2, y, 0, BLOCK.Water);
    world.setBlock(5, y, 0, BLOCK.Stone);
    const hit = raycastVoxel(world, { x: 0.5, y: y + 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 10);
    expect(hit?.x).toBe(5);
  });

  it('handles a downward ray and normal', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    world.setBlock(2, y, 2, BLOCK.Stone);
    const hit = raycastVoxel(world, { x: 2.5, y: y + 4, z: 2.5 }, { x: 0, y: -1, z: 0 }, 10);
    expect([hit?.ny]).toEqual([1]);
    expect(hit?.y).toBe(y);
  });
});