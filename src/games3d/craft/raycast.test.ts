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

  it('ignores liquids', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(world, y);
    world.setBlock(2, y, 0, BLOCK.Water);
    world.setBlock(3, y, 0, BLOCK.Lava);
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

  it('returns null for a zero-length or non-finite direction', () => {
    const world = new VoxelWorld('ray-test');
    const origin = { x: 0.5, y: 40.5, z: 0.5 };
    expect(raycastVoxel(world, origin, { x: 0, y: 0, z: 0 })).toBeNull();
    expect(raycastVoxel(world, origin, { x: Number.NaN, y: 0, z: 0 })).toBeNull();
    expect(raycastVoxel(world, origin, { x: Number.POSITIVE_INFINITY, y: 0, z: 0 })).toBeNull();
  });

  it('reaches a face exactly at maxDistance and not one beyond it', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(world, y);
    world.setBlock(5, y, 0, BLOCK.Stone);
    const origin = { x: 0.5, y: y + 0.5, z: 0.5 };
    const direction = { x: 1, y: 0, z: 0 };

    expect(raycastVoxel(world, origin, direction, 4.5)?.distance).toBeCloseTo(4.5, 9);
    expect(raycastVoxel(world, origin, direction, 4.49)).toBeNull();
  });

  it('uses the default reach of 5.5 blocks', () => {
    const near = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(near, y);
    near.setBlock(6, y, 0, BLOCK.Stone);
    expect(
      raycastVoxel(near, { x: 0.5, y: y + 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 })?.distance,
    ).toBeCloseTo(5.5, 9);

    const far = new VoxelWorld('ray-test');
    clearLine(far, y);
    far.setBlock(7, y, 0, BLOCK.Stone);
    expect(raycastVoxel(far, { x: 0.5, y: y + 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 })).toBeNull();
  });

  it('starts on the surface when the eye sits exactly on the near face', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(world, y);
    world.setBlock(5, y, 0, BLOCK.Stone);
    const hit = raycastVoxel(world, { x: 5, y: y + 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 2);
    expect([hit?.x, hit?.distance, hit?.nx]).toEqual([5, 0, -1]);
  });

  it('steps out of the cell behind a boundary origin instead of reporting it', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(world, y);
    world.setBlock(5, y, 0, BLOCK.Stone);
    world.setBlock(3, y, 0, BLOCK.Stone);
    const hit = raycastVoxel(world, { x: 5, y: y + 0.5, z: 0.5 }, { x: -1, y: 0, z: 0 }, 4);
    expect([hit?.x, hit?.distance, hit?.nx]).toEqual([3, 1, 1]);
  });

  it('faces back along the dominant axis when the origin is inside a block', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(world, y);
    world.setBlock(2, y, 0, BLOCK.Stone);
    const hit = raycastVoxel(world, { x: 2.5, y: y + 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 2);
    expect([hit?.x, hit?.distance, hit?.nx]).toEqual([2, 0, -1]);
  });

  it('resolves axis ties deterministically on an edge crossing', () => {
    const world = new VoxelWorld('ray-test');
    const y = 40;
    clearLine(world, y);
    world.setBlock(1, y + 1, 0, BLOCK.Stone);
    const hit = raycastVoxel(
      world,
      { x: 0.5, y: y + 0.5, z: 0.5 },
      { x: 1, y: 1, z: 0 },
      4,
    );
    expect([hit?.x, hit?.y, hit?.nx, hit?.ny]).toEqual([1, y + 1, 0, -1]);
    expect(hit?.distance).toBeCloseTo(Math.SQRT1_2, 9);
  });
});