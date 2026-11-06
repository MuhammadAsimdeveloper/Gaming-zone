import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import {
  BIOMES, CHUNK_HEIGHT, CHUNK_SIZE, SEA_LEVEL, blockIndex, createTerrain, findSpawn, generateChunk,
} from './terrain';

const terrain = createTerrain('neon-craft-test');

describe('terrain sampler', () => {
  it('is deterministic for the same seed', () => {
    const other = createTerrain('neon-craft-test');
    for (const [x, z] of [[0, 0], [37, -91], [-504, 128]] as const) {
      expect(other.heightAt(x, z)).toBe(terrain.heightAt(x, z));
      expect(other.biomeAt(x, z)).toBe(terrain.biomeAt(x, z));
    }
    for (let y = 0; y < CHUNK_HEIGHT; y += 3) {
      expect(other.blockAt(9, y, -4)).toBe(terrain.blockAt(9, y, -4));
    }
  });

  it('clamps heights and keeps sea level inside the world', () => {
    for (let x = -200; x <= 200; x += 17) {
      for (let z = -200; z <= 200; z += 23) {
        const height = terrain.heightAt(x, z);
        expect(height).toBeGreaterThanOrEqual(8);
        expect(height).toBeLessThanOrEqual(56);
      }
    }
    expect(SEA_LEVEL).toBe(32);
  });

  it('reaches all four biomes across a wide sample', () => {
    const seen = new Set<string>();
    for (let x = -600; x <= 600; x += 40) {
      for (let z = -600; z <= 600; z += 40) seen.add(terrain.biomeAt(x, z));
    }
    expect(seen).toEqual(new Set(Object.keys(BIOMES)));
  });

  it('builds bedrock at y=0 and air above the surface', () => {
    for (const [x, z] of [[0, 0], [15, 15], [-31, 7]] as const) {
      expect(terrain.blockAt(x, 0, z)).toBe(BLOCK.Bedrock);
      const height = terrain.heightAt(x, z);
      expect(terrain.blockAt(x, height, z)).not.toBe(BLOCK.Air);
      expect(terrain.blockAt(x, Math.min(CHUNK_HEIGHT - 1, height + 4), z)).toBe(BLOCK.Air);
    }
  });

  it('fills oceans up to sea level with water', () => {
    let found = 0;
    for (let x = -300; x <= 300 && found === 0; x += 7) {
      for (let z = -300; z <= 300 && found === 0; z += 7) {
        if (terrain.heightAt(x, z) < SEA_LEVEL) {
          expect(terrain.blockAt(x, SEA_LEVEL, z)).toBe(BLOCK.Water);
          found += 1;
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('generates a full chunk deterministically with bedrock', () => {
    const a = generateChunk(terrain, 0, 0);
    const b = generateChunk(createTerrain('neon-craft-test'), 0, 0);
    expect(a).toEqual(b);
    expect(a).toHaveLength(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    expect(a[blockIndex(0, 0, 0)]).toBe(BLOCK.Bedrock);
    expect(a[blockIndex(15, 0, 15)]).toBe(BLOCK.Bedrock);
  });

  it('places ores only inside their depth bands', () => {
    const oreBlocks = new Set<number>([
      BLOCK.CoalOre, BLOCK.IronOre, BLOCK.GoldOre, BLOCK.CrystalOre,
    ]);
    const found = new Set<number>();
    for (let cx = -2; cx <= 2; cx += 1) {
      for (let cz = -2; cz <= 2; cz += 1) {
        const chunk = generateChunk(terrain, cx, cz);
        for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
          for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i += 1) {
            const id = chunk[y * 256 + i];
            if (!oreBlocks.has(id)) continue;
            found.add(id);
            if (id === BLOCK.CoalOre) expect(y).toBeGreaterThanOrEqual(12);
            if (id === BLOCK.IronOre) { expect(y).toBeGreaterThanOrEqual(8); expect(y).toBeLessThanOrEqual(40); }
            if (id === BLOCK.GoldOre) { expect(y).toBeGreaterThanOrEqual(4); expect(y).toBeLessThanOrEqual(24); }
            if (id === BLOCK.CrystalOre) { expect(y).toBeGreaterThanOrEqual(2); expect(y).toBeLessThanOrEqual(18); }
          }
        }
      }
    }
    expect(found.size).toBeGreaterThanOrEqual(3);
  });

  it('finds a safe spawn above ground with headroom', () => {
    const spawn = findSpawn(terrain);
    expect(terrain.blockAt(spawn.x, spawn.y - 1, spawn.z)).not.toBe(BLOCK.Air);
    expect(terrain.blockAt(spawn.x, spawn.y, spawn.z)).toBe(BLOCK.Air);
    expect(terrain.blockAt(spawn.x, spawn.y + 1, spawn.z)).toBe(BLOCK.Air);
  });
});
