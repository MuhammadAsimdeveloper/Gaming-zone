import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { combinedLight, computeChunkLight } from './light';
import { blockIndex } from './terrain';
import { VoxelWorld } from './world';

function surface(world: VoxelWorld, x: number, z: number): number {
  for (let y = 63; y > 0; y -= 1) {
    const id = world.getBlock(x, y, z);
    if (id !== BLOCK.Air && id !== BLOCK.Water) return y;
  }
  return 0;
}

describe('light', () => {
  it('gives open sky the maximum level and buries solid ground at zero', () => {
    const world = new VoxelWorld('light-test');
    const height = surface(world, 2, 2);
    const light = computeChunkLight(world, 0, 0);
    expect(combinedLight(light, 2, height + 1, 2)).toBe(15);
    expect(light.sky[blockIndex(2, height, 2)]).toBe(0);
  });

  it('removes skylight inside a sealed roofed room', () => {
    const world = new VoxelWorld('light-test');
    const h = surface(world, 4, 4) + 2;
    for (let x = 2; x <= 6; x += 1) {
      for (let z = 2; z <= 6; z += 1) {
        world.setBlock(x, h + 1, z, BLOCK.Stone);
        if (x === 2 || x === 6 || z === 2 || z === 6) {
          world.setBlock(x, h, z, BLOCK.Stone);
          world.setBlock(x, h - 1, z, BLOCK.Stone);
        }
      }
    }
    const light = computeChunkLight(world, 0, 0);
    expect(light.sky[blockIndex(4, h, 4)]).toBe(0);
  });

  it('propagates torch light with a one-level falloff', () => {
    const world = new VoxelWorld('light-test');
    const y = surface(world, 8, 8) + 1;
    for (let dx = -3; dx <= 3; dx += 1) {
      for (let dz = -3; dz <= 3; dz += 1) {
        for (let dy = 0; dy <= 2; dy += 1) world.setBlock(8 + dx, y + dy, 8 + dz, BLOCK.Air);
      }
    }
    world.setBlock(8, y, 8, BLOCK.Torch);
    const light = computeChunkLight(world, 0, 0);
    expect(light.block[blockIndex(8, y, 8)]).toBe(12);
    expect(light.block[blockIndex(9, y, 8)]).toBe(11);
    expect(light.block[blockIndex(10, y, 8)]).toBe(10);
  });

  it('stops blocklight outside an opaque shell', () => {
    const world = new VoxelWorld('light-test');
    const y = surface(world, 8, 8) + 1;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          world.setBlock(8 + dx, y + dy, 8 + dz, BLOCK.Stone);
        }
      }
    }
    world.setBlock(8, y, 8, BLOCK.Torch);
    const light = computeChunkLight(world, 0, 0);
    expect(light.block[blockIndex(8, y, 8)]).toBe(12);
    expect(light.block[blockIndex(10, y, 8)]).toBe(0);
  });
});
