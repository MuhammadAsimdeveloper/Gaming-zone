# Neon Craft World Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic, engine-independent voxel core for Neon Craft: block data, seeded noise, terrain and caves, chunk storage with edits, skylight/blocklight, greedy meshing and DDA picking.

**Architecture:** Seven focused TypeScript modules under `src/games3d/craft/`, each pure and testable in Node with Vitest. No Three.js, React or DOM code in this plan; the renderer consumes the meshes and ray hits in the next plan. Chunks are 16 × 64 × 16 `Uint8Array` volumes generated from a string seed and an edits overlay so saves stay small.

**Tech Stack:** TypeScript 5.9 strict, Vitest 5, Node 24, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-04-games-wave2-design.md` (§ Neon Craft — design)

## Global Constraints

- Original code and art only. No Minecraft code, textures, models, sounds, names or world data.
- Open-source repositories are reading references only; no GPL/AGPL/unlicensed code is copied or vendored.
- No new runtime dependencies and no paid services.
- Stay on branch `feat/games-wave2`; never force-push; never merge to `main`; never deploy.
- Automatic pushes are approved for commits on this branch.
- Test-first: watch every new test fail for the expected reason before writing implementation.
- Deterministic output for a given seed; no `Math.random()` in world generation.
- Strict TypeScript: no unused locals or parameters, no `any` in new public APIs.
- Keep modules pure and side-effect free except `VoxelWorld` chunk caching.

---

## File structure

| File | Responsibility |
|---|---|
| `src/games3d/craft/blocks.ts` | Block IDs, specs, texture keys, classification helpers |
| `src/games3d/craft/noise.ts` | Seed hash, PRNG, value noise 2D/3D, fBm |
| `src/games3d/craft/terrain.ts` | Biomes, height field, caves, ores, flora, spawn |
| `src/games3d/craft/world.ts` | Chunk cache, block get/set, edit overlay, dirty tracking |
| `src/games3d/craft/light.ts` | Skylight and blocklight propagation per chunk |
| `src/games3d/craft/mesher.ts` | Greedy face meshing, AO and baked light, three geometry buckets |
| `src/games3d/craft/raycast.ts` | Amanatides–Woo voxel ray traversal |

Tests live beside each module as `<name>.test.ts` and run in the default Node environment.

---

### Task 1: Block registry and classification

**Files:**
- Create: `src/games3d/craft/blocks.ts`
- Test: `src/games3d/craft/blocks.test.ts`

**Interfaces:**
- Produces: `BLOCK`, `BlockId`, `TextureKey`, `BlockSpec`, `BLOCKS`, `blockSpec(id)`, `isSolidBlock(id)`, `isOpaqueBlock(id)`, `isLiquidBlock(id)`, `isCutoutBlock(id)`, `lightOf(id)`, `isReplaceable(id)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  BLOCK,
  BLOCKS,
  blockSpec,
  isCutoutBlock,
  isLiquidBlock,
  isOpaqueBlock,
  isReplaceable,
  isSolidBlock,
  lightOf,
} from './blocks';

describe('block registry', () => {
  it('assigns unique IDs to every block', () => {
    const ids = Object.values(BLOCK);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(BLOCK.Air);
    expect(ids).toContain(BLOCK.Water);
    expect(ids).toContain(BLOCK.Lava);
  });

  it('describes air, stone and water correctly', () => {
    expect(isSolidBlock(BLOCK.Air)).toBe(false);
    expect(isSolidBlock(BLOCK.Stone)).toBe(true);
    expect(isOpaqueBlock(BLOCK.Stone)).toBe(true);
    expect(isLiquidBlock(BLOCK.Water)).toBe(true);
    expect(isSolidBlock(BLOCK.Water)).toBe(false);
    expect(isOpaqueBlock(BLOCK.Water)).toBe(false);
  });

  it('keeps glass solid but not opaque and leaves cutout', () => {
    expect(isSolidBlock(BLOCK.Glass)).toBe(true);
    expect(isOpaqueBlock(BLOCK.Glass)).toBe(false);
    expect(isCutoutBlock(BLOCK.RiftwoodLeaves)).toBe(true);
    expect(isOpaqueBlock(BLOCK.RiftwoodLeaves)).toBe(false);
  });

  it('exposes light emission for torches, lanterns, glow flora and lava', () => {
    expect(lightOf(BLOCK.Torch)).toBe(12);
    expect(lightOf(BLOCK.Lantern)).toBe(14);
    expect(lightOf(BLOCK.Glowcap)).toBe(7);
    expect(lightOf(BLOCK.Lava)).toBe(15);
    expect(lightOf(BLOCK.Stone)).toBe(0);
  });

  it('defines drops, tool tiers and replaceable blocks', () => {
    expect(blockSpec(BLOCK.Grass).drop).toBe(BLOCK.Dirt);
    expect(blockSpec(BLOCK.Stone).drop).toBe(BLOCK.Cobblestone);
    expect(blockSpec(BLOCK.IronOre).minTier).toBe(2);
    expect(blockSpec(BLOCK.CrystalOre).minTier).toBe(2);
    expect(isReplaceable(BLOCK.Air)).toBe(true);
    expect(isReplaceable(BLOCK.Reeds)).toBe(true);
    expect(isReplaceable(BLOCK.Stone)).toBe(false);
    expect(Object.keys(BLOCKS)).toHaveLength(35);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/games3d/craft/blocks.test.ts`
Expected: FAIL with a module-not-found error for `./blocks`.

- [ ] **Step 3: Write the minimal implementation**

```ts
export const BLOCK = {
  Air: 0,
  Bedrock: 1,
  Stone: 2,
  Cobblestone: 3,
  Dirt: 4,
  Grass: 5,
  Sand: 6,
  Gravel: 7,
  Clay: 8,
  Mud: 9,
  Emberstone: 10,
  Ash: 11,
  Moss: 12,
  RiftwoodLog: 13,
  RiftwoodLeaves: 14,
  GlowwoodLog: 15,
  GlowwoodLeaves: 16,
  Glowcap: 17,
  Reeds: 18,
  GlowKelp: 19,
  Flower: 20,
  CoalOre: 21,
  IronOre: 22,
  GoldOre: 23,
  CrystalOre: 24,
  Planks: 25,
  Workbench: 26,
  Kiln: 27,
  Torch: 28,
  Lantern: 29,
  Glass: 30,
  Gilded: 31,
  Bricks: 32,
  Water: 33,
  Lava: 34,
} as const;

export type BlockId = (typeof BLOCK)[keyof typeof BLOCK];

export type TextureKey =
  | 'stone' | 'cobblestone' | 'dirt' | 'grass_top' | 'grass_side'
  | 'sand' | 'gravel' | 'clay' | 'mud' | 'emberstone' | 'ash' | 'moss'
  | 'riftwood_top' | 'riftwood_side' | 'leaves'
  | 'glowwood_top' | 'glowwood_side' | 'glow_leaves'
  | 'glowcap' | 'reeds' | 'glowkelp' | 'flower'
  | 'coal_ore' | 'iron_ore' | 'gold_ore' | 'crystal_ore'
  | 'planks' | 'workbench_top' | 'workbench_side'
  | 'kiln_top' | 'kiln_side' | 'torch' | 'lantern'
  | 'glass' | 'gilded' | 'bricks' | 'water' | 'lava';

export interface BlockSpec {
  id: BlockId;
  name: string;
  solid: boolean;
  opaque: boolean;
  cutout: boolean;
  liquid: boolean;
  light: number;
  hardness: number;
  tool: 'none' | 'pickaxe' | 'axe' | 'shovel';
  minTier: 0 | 1 | 2 | 3;
  drop: BlockId;
  replaceable: boolean;
  textures: { top: TextureKey; bottom: TextureKey; side: TextureKey };
}

function spec(
  id: BlockId,
  name: string,
  overrides: Partial<Omit<BlockSpec, 'id' | 'name'>> = {},
): BlockSpec {
  return {
    id,
    name,
    solid: true,
    opaque: true,
    cutout: false,
    liquid: false,
    light: 0,
    hardness: 1.5,
    tool: 'pickaxe',
    minTier: 1,
    drop: id,
    replaceable: false,
    textures: { top: 'stone', bottom: 'stone', side: 'stone' },
    ...overrides,
  };
}

export const BLOCKS: Record<number, BlockSpec> = {
  [BLOCK.Air]: spec(BLOCK.Air, 'Air', {
    solid: false, opaque: false, replaceable: true, hardness: 0, tool: 'none',
    minTier: 0, drop: BLOCK.Air,
  }),
  [BLOCK.Bedrock]: spec(BLOCK.Bedrock, 'Bedrock', { hardness: Infinity, drop: BLOCK.Air }),
  [BLOCK.Stone]: spec(BLOCK.Stone, 'Stone', { drop: BLOCK.Cobblestone, hardness: 2.2 }),
  [BLOCK.Cobblestone]: spec(BLOCK.Cobblestone, 'Cobblestone', {
    textures: { top: 'cobblestone', bottom: 'cobblestone', side: 'cobblestone' },
  }),
  [BLOCK.Dirt]: spec(BLOCK.Dirt, 'Dirt', {
    tool: 'shovel', hardness: 0.6,
    textures: { top: 'dirt', bottom: 'dirt', side: 'dirt' },
  }),
  [BLOCK.Grass]: spec(BLOCK.Grass, 'Grass', {
    tool: 'shovel', hardness: 0.7, drop: BLOCK.Dirt,
    textures: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
  }),
  // Continue for every remaining ID with the values in the table below.
};

export function blockSpec(id: number): BlockSpec {
  return BLOCKS[id] ?? BLOCKS[BLOCK.Air];
}

export function isSolidBlock(id: number): boolean { return blockSpec(id).solid; }
export function isOpaqueBlock(id: number): boolean { return blockSpec(id).opaque; }
export function isLiquidBlock(id: number): boolean { return blockSpec(id).liquid; }
export function isCutoutBlock(id: number): boolean { return blockSpec(id).cutout; }
export function lightOf(id: number): number { return blockSpec(id).light; }
export function isReplaceable(id: number): boolean { return blockSpec(id).replaceable; }
```

Complete the `BLOCKS` record with these exact properties for the remaining IDs:

| Block | solid | opaque | cutout | liquid | light | hardness | tool | minTier | drop | replaceable | textures top/bottom/side |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gravel | true | true | false | false | 0 | 0.7 | shovel | 0 | self | false | gravel |
| Clay | true | true | false | false | 0 | 0.6 | shovel | 0 | self | false | clay |
| Mud | true | true | false | false | 0 | 0.5 | shovel | 0 | self | false | mud |
| Emberstone | true | true | false | false | 0 | 2.0 | pickaxe | 1 | self | false | emberstone |
| Ash | true | true | false | false | 0 | 0.4 | shovel | 0 | self | false | ash |
| Moss | true | true | false | false | 0 | 0.5 | shovel | 0 | self | false | moss |
| RiftwoodLog | true | true | false | false | 0 | 1.8 | axe | 0 | self | false | riftwood_top/riftwood_top/riftwood_side |
| RiftwoodLeaves | true | false | true | false | 0 | 0.3 | axe | 0 | Air | false | leaves |
| GlowwoodLog | true | true | false | false | 0 | 1.8 | axe | 0 | self | false | glowwood_top/glowwood_top/glowwood_side |
| GlowwoodLeaves | true | false | true | false | 6 | 0.3 | axe | 0 | Air | false | glow_leaves |
| Glowcap | false | false | true | false | 7 | 0.2 | axe | 0 | self | true | glowcap |
| Reeds | false | false | true | false | 0 | 0.1 | none | 0 | self | true | reeds |
| GlowKelp | false | false | true | false | 4 | 0.1 | none | 0 | self | true | glowkelp |
| Flower | false | false | true | false | 0 | 0.1 | none | 0 | self | true | flower |
| CoalOre | true | true | false | false | 0 | 2.6 | pickaxe | 1 | self | false | coal_ore |
| IronOre | true | true | false | false | 0 | 3.0 | pickaxe | 2 | self | false | iron_ore |
| GoldOre | true | true | false | false | 0 | 3.2 | pickaxe | 2 | self | false | gold_ore |
| CrystalOre | true | true | false | false | 0 | 3.6 | pickaxe | 2 | self | false | crystal_ore |
| Planks | true | true | false | false | 0 | 1.2 | axe | 0 | self | false | planks |
| Workbench | true | true | false | false | 0 | 1.2 | axe | 0 | self | false | workbench_top/workbench_top/workbench_side |
| Kiln | true | true | false | false | 0 | 2.0 | pickaxe | 1 | self | false | kiln_top/kiln_top/kiln_side |
| Torch | false | false | true | false | 12 | 0.1 | none | 0 | self | true | torch |
| Lantern | false | false | true | false | 14 | 0.3 | pickaxe | 0 | self | true | lantern |
| Glass | true | false | true | false | 0 | 0.4 | pickaxe | 0 | Air | false | glass |
| Gilded | true | true | false | false | 0 | 3.0 | pickaxe | 2 | self | false | gilded |
| Bricks | true | true | false | false | 0 | 2.0 | pickaxe | 1 | self | false | bricks |
| Water | false | false | false | true | 0 | 0 | none | 0 | Air | true | water |
| Lava | false | false | false | true | 15 | 0 | none | 0 | Air | true | lava |

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/games3d/craft/blocks.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/games3d/craft/blocks.ts src/games3d/craft/blocks.test.ts
git commit -m "feat(craft): add block registry"
git push
```

---

### Task 2: Seeded hash, PRNG and value noise

**Files:**
- Create: `src/games3d/craft/noise.ts`
- Test: `src/games3d/craft/noise.test.ts`

**Interfaces:**
- Produces: `hashSeed(input: string): number`, `mulberry32(seed: number): () => number`, `makeNoise2D(seed: number): (x: number, y: number) => number`, `makeNoise3D(seed: number): (x: number, y: number, z: number) => number`, `fbm2(noise, x, y, octaves, lacunarity?, gain?): number`, `fbm3(noise, x, y, z, octaves, lacunarity?, gain?): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { fbm2, fbm3, hashSeed, makeNoise2D, makeNoise3D, mulberry32 } from './noise';

describe('seeded noise', () => {
  it('hashes strings deterministically and differently', () => {
    expect(hashSeed('neon-rift')).toBe(hashSeed('neon-rift'));
    expect(hashSeed('neon-rift')).not.toBe(hashSeed('neon-rift-2'));
    expect(Number.isInteger(hashSeed('seed'))).toBe(true);
  });

  it('produces a deterministic PRNG stream in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const values = Array.from({ length: 8 }, () => a());
    expect(values).toEqual(Array.from({ length: 8 }, () => b()));
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('returns stable 2D noise in [-1, 1]', () => {
    const noise = makeNoise2D(1234);
    expect(noise(3.25, -7.5)).toBe(noise(3.25, -7.5));
    for (let x = -20; x <= 20; x += 0.5) {
      for (let y = -20; y <= 20; y += 0.5) {
        const value = noise(x, y);
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('returns stable 3D noise and different values per seed', () => {
    const a = makeNoise3D(7);
    const b = makeNoise3D(8);
    const sample = a(1.5, 2.5, -3.5);
    expect(sample).toBe(a(1.5, 2.5, -3.5));
    expect(sample).not.toBe(b(1.5, 2.5, -3.5));
  });

  it('keeps fBm output in [-1, 1] and changes with octaves', () => {
    const noise = makeNoise2D(99);
    const noise3 = makeNoise3D(99);
    for (let i = 0; i < 50; i += 1) {
      const value = fbm2(noise, i * 0.37, i * -0.21, 4);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
      const value3 = fbm3(noise3, i * 0.37, i * 0.11, i * -0.21, 3);
      expect(value3).toBeGreaterThanOrEqual(-1);
      expect(value3).toBeLessThanOrEqual(1);
    }
    expect(fbm2(noise, 1.2, 3.4, 1)).not.toBe(fbm2(noise, 1.2, 3.4, 4));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/games3d/craft/noise.test.ts`
Expected: FAIL with a module-not-found error for `./noise`.

- [ ] **Step 3: Write the implementation**

```ts
export function hashSeed(input: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function makeNoise2D(seed: number): (x: number, y: number) => number {
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const v00 = hash2(x0, y0, seed);
    const v10 = hash2(x0 + 1, y0, seed);
    const v01 = hash2(x0, y0 + 1, seed);
    const v11 = hash2(x0 + 1, y0 + 1, seed);
    const top = lerp(v00, v10, tx);
    const bottom = lerp(v01, v11, tx);
    return lerp(top, bottom, ty) * 2 - 1;
  };
}

export function makeNoise3D(seed: number): (x: number, y: number, z: number) => number {
  return (x, y, z) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const tz = fade(z - z0);
    const c000 = hash3(x0, y0, z0, seed);
    const c100 = hash3(x0 + 1, y0, z0, seed);
    const c010 = hash3(x0, y0 + 1, z0, seed);
    const c110 = hash3(x0 + 1, y0 + 1, z0, seed);
    const c001 = hash3(x0, y0, z0 + 1, seed);
    const c101 = hash3(x0 + 1, y0, z0 + 1, seed);
    const c011 = hash3(x0, y0 + 1, z0 + 1, seed);
    const c111 = hash3(x0 + 1, y0 + 1, z0 + 1, seed);
    const x00 = lerp(c000, c100, tx);
    const x10 = lerp(c010, c110, tx);
    const x01 = lerp(c001, c101, tx);
    const x11 = lerp(c011, c111, tx);
    const y0v = lerp(x00, x10, ty);
    const y1v = lerp(x01, x11, ty);
    return lerp(y0v, y1v, tz) * 2 - 1;
  };
}

type Noise2 = (x: number, y: number) => number;
type Noise3 = (x: number, y: number, z: number) => number;

export function fbm2(
  noise: Noise2, x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5,
): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return total === 0 ? 0 : sum / total;
}

export function fbm3(
  noise: Noise3, x: number, y: number, z: number, octaves: number,
  lacunarity = 2, gain = 0.5,
): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise(x * frequency, y * frequency, z * frequency) * amplitude;
    total += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return total === 0 ? 0 : sum / total;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/games3d/craft/noise.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/games3d/craft/noise.ts src/games3d/craft/noise.test.ts
git commit -m "feat(craft): add seeded noise"
git push
```

---

### Task 3: Terrain, biomes, caves, ores and flora

**Files:**
- Create: `src/games3d/craft/terrain.ts`
- Test: `src/games3d/craft/terrain.test.ts`

**Interfaces:**
- Consumes: `BLOCK`, `BlockId`, `isOpaqueBlock` from `./blocks`; noise factories from `./noise`.
- Produces: `CHUNK_SIZE`, `CHUNK_HEIGHT`, `SEA_LEVEL`, `BiomeId`, `BIOMES`, `TerrainSampler`, `createTerrain(seed: string): TerrainSampler`, `generateChunk(terrain, cx, cz): Uint8Array`, `findSpawn(terrain): { x: number; y: number; z: number }`, `blockIndex(lx, ly, lz): number`.

`TerrainSampler` shape:

```ts
export interface TerrainSampler {
  readonly seed: number;
  biomeAt(x: number, z: number): BiomeId;
  heightAt(x: number, z: number): number;
  blockAt(x: number, y: number, z: number): BlockId;
}
```

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/games3d/craft/terrain.test.ts`
Expected: FAIL with a module-not-found error for `./terrain`.

- [ ] **Step 3: Write the implementation**

Implement with these exact constants and sampling rules:

```ts
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const SEA_LEVEL = 32;

export type BiomeId = 'plains' | 'ridge' | 'glowwood' | 'marsh';

export const BIOMES: Record<BiomeId, {
  id: BiomeId; name: string; surface: BlockId; subsurface: BlockId;
}> = {
  plains: { id: 'plains', name: 'Verdant Plains', surface: BLOCK.Grass, subsurface: BLOCK.Dirt },
  ridge: { id: 'ridge', name: 'Ember Ridge', surface: BLOCK.Emberstone, subsurface: BLOCK.Ash },
  glowwood: { id: 'glowwood', name: 'Glowwood', surface: BLOCK.Moss, subsurface: BLOCK.Dirt },
  marsh: { id: 'marsh', name: 'Rift Marsh', surface: BLOCK.Mud, subsurface: BLOCK.Clay },
};

export function blockIndex(lx: number, ly: number, lz: number): number {
  return ly * 256 + lz * 16 + lx;
}
```

`createTerrain(seed)` creates `makeNoise2D`/`makeNoise3D` with derived seeds (`hashSeed(seed)`, `+1`, `+2`, …) and returns:

- `heightAt(x, z)`:
  ```ts
  const continent = fbm2(continentNoise, x / 160, z / 160, 3);
  const detail = fbm2(detailNoise, x / 48, z / 48, 4);
  return Math.max(8, Math.min(56, Math.round(26 + continent * 18 + detail * 10)));
  ```
- `biomeAt(x, z)`:
  ```ts
  const temperature = fbm2(temperatureNoise, x / 220, z / 220, 2);
  const humidity = fbm2(humidityNoise, x / 180, z / 180, 2);
  if (temperature > 0.25) return 'ridge';
  if (humidity > 0.2) return 'marsh';
  if (humidity > -0.05) return 'glowwood';
  return 'plains';
  ```
- `blockAt(x, y, z)`:
  - `y < 0 || y >= CHUNK_HEIGHT` → `Air`; `y === 0` → `Bedrock`.
  - `height = heightAt(x, z)`, `biome = BIOMES[biomeAt(x, z)]`.
  - `y > height`: `Water` if `y <= SEA_LEVEL`, else `Air`.
  - cave check before surface material: only when `y > 1 && y < height - 1`; carve with two 3D fBm fields at scales 1/30, 1/22, 1/30:
    ```ts
    const a = fbm3(caveA, x / 30, y / 22, z / 30, 2);
    const b = fbm3(caveB, x / 30, y / 22, z / 30, 2);
    const tunnel = Math.abs(a) < 0.075 && Math.abs(b) < 0.09;
    const cavern = y < 28 && fbm3(caveC, x / 48, y / 34, z / 48, 3) > 0.55;
    if (tunnel || cavern) return y <= 9 && biome.id === 'ridge' ? BLOCK.Lava : BLOCK.Air;
    ```
  - ore check before surface material while `y < height - 2`:
    ```ts
    const ore = fbm3(oreNoise, x / 26, y / 20, z / 26, 2);
    if (y >= 2 && y <= 18 && ore < -0.8) return BLOCK.CrystalOre;
    if (y >= 4 && y <= 24 && ore > 0.79) return BLOCK.GoldOre;
    if (y >= 8 && y <= 40 && ore < -0.66) return BLOCK.IronOre;
    if (y >= 12 && y <= 52 && ore > 0.62) return BLOCK.CoalOre;
    ```
  - `y === height`: `Sand` when `height <= SEA_LEVEL + 1`, otherwise biome surface.
  - `y >= height - 3`: biome subsurface; else `Stone`.
- `generateChunk(terrain, cx, cz)` fills a `Uint8Array(16 * 64 * 16)` using `terrain.blockAt(cx * 16 + lx, y, cz * 16 + lz)`, then calls `decorateChunk` (below).
- `decorateChunk`: for each of the 3 × 3 neighbouring chunk cells, evaluate candidate columns with a deterministic hash (`mulberry32(hash)`) and place decorations only when the resulting block lands inside the target chunk. Trees are 4–6 log blocks tall with a 5 × 5 leaf canopy at the top two layers, minus corners; Glowwood trees use glowwood logs and glowwood leaves; plains use riftwood. Place reeds and glow kelp on columns whose surface is within one block of sea level, glowcap on moss, and flowers on grass with a 1-in-24 chance. Never replace `Bedrock` or existing non-air blocks.
- `findSpawn` scans outward from `(0, 0)` in a square spiral up to radius 64 and returns the first column whose surface is at or above sea level, with the block above air and two more air blocks above that; if none is found, return `{ x: 0, y: SEA_LEVEL + 2, z: 0 }`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/games3d/craft/terrain.test.ts`
Expected: PASS, 8 tests. If the ore-distribution or biome-coverage assertion fails for the fixed seed, adjust only the noise thresholds until all four biomes and at least three ore types appear; do not weaken the depth-band assertions.

- [ ] **Step 5: Commit**

```bash
git add src/games3d/craft/terrain.ts src/games3d/craft/terrain.test.ts
git commit -m "feat(craft): add biomes, caves, ores and flora generation"
git push
```

---

### Task 4: Chunk storage, edit overlay and dirty tracking

**Files:**
- Create: `src/games3d/craft/world.ts`
- Test: `src/games3d/craft/world.test.ts`

**Interfaces:**
- Consumes: `generateChunk`, `createTerrain`, `blockIndex`, `CHUNK_SIZE`, `CHUNK_HEIGHT` from `./terrain`; `BLOCK`, `BlockId` from `./blocks`.
- Produces: `Chunk`, `chunkKey(cx, cz)`, `VoxelWorld`, `VoxelEdit`, `worldToChunk(x, z)`.

`VoxelWorld` API:

```ts
export interface Chunk {
  cx: number; cz: number; blocks: Uint8Array; dirty: boolean;
}

export interface VoxelEdit { x: number; y: number; z: number; id: BlockId; }

export class VoxelWorld {
  constructor(seed: string);
  ensureChunk(cx: number, cz: number): Chunk;
  getChunk(cx: number, cz: number): Chunk | undefined;
  getBlock(x: number, y: number, z: number): BlockId;
  setBlock(x: number, y: number, z: number, id: BlockId): boolean;
  isSolid(x: number, y: number, z: number): boolean;
  unloadChunk(cx: number, cz: number): void;
  takeDirtyChunks(): Chunk[];
  editsForSave(): VoxelEdit[];
  applyEdits(edits: readonly VoxelEdit[]): void;
}
```

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/games3d/craft/world.test.ts`
Expected: FAIL with a module-not-found error for `./world`.

- [ ] **Step 3: Write the implementation**

Key rules:

```ts
export function worldToChunk(x: number, z: number): { cx: number; cz: number } {
  return { cx: Math.floor(x / CHUNK_SIZE), cz: Math.floor(z / CHUNK_SIZE) };
}
export function chunkKey(cx: number, cz: number): string { return `${cx},${cz}`; }
```

- Constructor stores `seed`, `terrain = createTerrain(seed)`, a `Map<string, Chunk>` cache, and `edits: Map<string, Map<number, BlockId>>`.
- `ensureChunk` generates `generateChunk(terrain, cx, cz)`, applies stored edits by local index, sets `dirty: true`, caches and returns the chunk.
- `getBlock` returns `Air` for `y < 0 || y >= CHUNK_HEIGHT`; resolves chunk and local coordinates with `Math.floor`; calls `ensureChunk` for missing chunks.
- `setBlock` returns `false` for out-of-range Y, identical values, or `Bedrock` removal; otherwise writes, records the edit by `blockIndex(lx, ly, lz)`, marks the chunk dirty, and marks neighbouring chunks dirty when `lx` is 0 or 15 or `lz` is 0 or 15. Return `true`.
- `unloadChunk` deletes the cache entry only; edits remain in the overlay.
- `takeDirtyChunks` returns the chunks whose `dirty` flag is set, resets each flag to `false`, and clears the set.
- `editsForSave` flattens the overlay into `{ x, y, z, id }[]` using chunk origin plus local index.
- `applyEdits` validates `id` is a known block and replays edits through the overlay, invalidating any cached chunk.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/games3d/craft/world.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/games3d/craft/world.ts src/games3d/craft/world.test.ts
git commit -m "feat(craft): add chunked world storage and edit overlay"
git push
```

---

### Task 5: Skylight and blocklight

**Files:**
- Create: `src/games3d/craft/light.ts`
- Test: `src/games3d/craft/light.test.ts`

**Interfaces:**
- Consumes: `VoxelWorld` from `./world`; `BLOCK`, `isOpaqueBlock`, `lightOf` from `./blocks`; `CHUNK_SIZE`, `CHUNK_HEIGHT`, `blockIndex` from `./terrain`.
- Produces: `ChunkLight`, `computeChunkLight(world, cx, cz): ChunkLight`, `combinedLight(light, lx, ly, lz): number`.

```ts
export interface ChunkLight { sky: Uint8Array; block: Uint8Array; }
```

- [ ] **Step 1: Write the failing test**

```ts
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

  it('removes skylight under a roof', () => {
    const world = new VoxelWorld('light-test');
    const height = surface(world, 4, 4) + 2;
    world.setBlock(4, height + 1, 4, BLOCK.Stone);
    world.setBlock(4, height + 2, 4, BLOCK.Stone);
    const light = computeChunkLight(world, 0, 0);
    expect(light.sky[blockIndex(4, height, 4)]).toBe(0);
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

  it('stops blocklight at opaque walls', () => {
    const world = new VoxelWorld('light-test');
    const y = surface(world, 8, 8) + 1;
    world.setBlock(8, y, 8, BLOCK.Torch);
    world.setBlock(9, y, 8, BLOCK.Stone);
    const light = computeChunkLight(world, 0, 0);
    expect(light.block[blockIndex(10, y, 8)]).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/games3d/craft/light.test.ts`
Expected: FAIL with a module-not-found error for `./light`.

- [ ] **Step 3: Write the implementation**

- Build padded 3 × 3 chunk block snapshots only for the target chunk's neighbourhood using `world.getBlock` (no mutation).
- **Skylight:** initialise every cell in the target chunk; a cell is sky-exposed when no opaque block exists above it in that column. Set exposed cells to 15, then BFS across the padded volume: opaque cells stay 0; transparent neighbours receive `current - 1`, except a downward move from level 15 through a transparent block keeps 15. Write only target-chunk values to the output.
- **Blocklight:** scan the padded 3 × 3 area for `lightOf(id) > 0`; seed those cells with their emission value and BFS with `current - 1` through non-opaque cells. Write target-chunk values.
- Use a flat `Uint8Array` queue of `x, y, z, level` quadruples or an array of packed indices; cap iterations at the padded volume to guarantee termination.
- `combinedLight(light, lx, ly, lz)` returns `Math.max(sky[i], block[i])` with 0 for out-of-range coordinates.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/games3d/craft/light.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/games3d/craft/light.ts src/games3d/craft/light.test.ts
git commit -m "feat(craft): add skylight and blocklight propagation"
git push
```

---

### Task 6: Greedy chunk mesher with AO and baked light

**Files:**
- Create: `src/games3d/craft/mesher.ts`
- Test: `src/games3d/craft/mesher.test.ts`

**Interfaces:**
- Consumes: `VoxelWorld`; `BLOCK`, `isOpaqueBlock`, `isCutoutBlock`, `isLiquidBlock`, `blockSpec`; `ChunkLight` from `./light`; `CHUNK_SIZE`, `CHUNK_HEIGHT` from `./terrain`.
- Produces: `MeshBuffers`, `ChunkMesh`, `meshChunk(world, cx, cz, light): ChunkMesh`.

```ts
export interface MeshBuffers {
  positions: number[]; normals: number[]; uvs: number[]; colors: number[]; indices: number[];
}
export interface ChunkMesh { opaque: MeshBuffers; cutout: MeshBuffers; transparent: MeshBuffers; }
export function meshChunk(world: VoxelWorld, cx: number, cz: number, light: ChunkLight): ChunkMesh;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { computeChunkLight } from './light';
import { meshChunk } from './mesher';
import { VoxelWorld } from './world';

function emptyWorld(): { world: VoxelWorld; y: number } {
  const world = new VoxelWorld('mesh-test');
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
    expect(mesh.opaque.indices.length / 6).toBe(10);
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/games3d/craft/mesher.test.ts`
Expected: FAIL with a module-not-found error for `./mesher`.

- [ ] **Step 3: Write the implementation**

- Iterate the three axes `d ∈ {0,1,2}` and both directions `dir ∈ {+1,-1}`; `u = (d+1)%3`, `v = (d+2)%3`.
- For each slice along `d`, build a mask of visible faces: a face is visible when the neighbour in `dir` is not opaque and is not the same liquid for water; cutout and transparent blocks are collected separately. Each mask entry stores `{ id, light, ao: [number, number, number, number], face: TextureKey }`.
- Compute AO for each face corner from the three neighbouring cells (two sides and the diagonal) using the standard 0–3 occlusion rule; a fully enclosed corner is 0.0, open is 1.0. Compute the face light as `combinedLight` at the neighbouring air cell.
- Greedy-merge rectangles in the mask only when `id`, light, all four AO values and texture key match; cap width and height at 16. Emit one quad per rectangle with correct winding, UVs spanning the merged area, and per-vertex color `(0.12 + 0.88 * light / 15) * ao`.
- Route the quad into `opaque`, `cutout` or `transparent` by block class. Water faces use the `water` texture key and glass uses `glass`; leaves and plants use `cutout`.
- Do not emit faces adjacent to opaque blocks. Do not emit interior faces for water against water.
- Face winding must be counter-clockwise when viewed from outside; normals are unit axis vectors.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/games3d/craft/mesher.test.ts`
Expected: PASS, 5 tests. The single-block test must report exactly 6 quads (36 indices) and the two-block test exactly 10 quads (60 indices).

- [ ] **Step 5: Commit**

```bash
git add src/games3d/craft/mesher.ts src/games3d/craft/mesher.test.ts
git commit -m "feat(craft): add greedy mesher with ambient occlusion"
git push
```

---

### Task 7: DDA voxel picking

**Files:**
- Create: `src/games3d/craft/raycast.ts`
- Test: `src/games3d/craft/raycast.test.ts`

**Interfaces:**
- Consumes: `VoxelWorld` from `./world`; `BLOCK`, `isSolidBlock`, `isLiquidBlock` from `./blocks`.
- Produces: `Vec3`, `RayHit`, `raycastVoxel(world, origin, direction, maxDistance?): RayHit | null`.

```ts
export interface Vec3 { x: number; y: number; z: number; }
export interface RayHit {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  distance: number;
}
```

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/games3d/craft/raycast.test.ts`
Expected: FAIL with a module-not-found error for `./raycast`.

- [ ] **Step 3: Write the implementation**

Implement Amanatides–Woo:

1. Normalise `direction`; return `null` for a zero-length vector.
2. Start at `floor(origin)`; step signs `sign(direction)`.
3. Compute `tDelta = abs(1 / direction)` per non-zero axis; `tMax` is distance to the next voxel boundary.
4. Track the face normal as the axis of the last step, opposite the step direction.
5. On each iteration, if the current cell `isSolidBlock` and not `isLiquidBlock`, return hit with `distance` = entry `t`.
6. Step the smallest `tMax`, update the normal, stop when `t > maxDistance`.
7. Default `maxDistance` is `5.5`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/games3d/craft/raycast.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/games3d/craft/raycast.ts src/games3d/craft/raycast.test.ts
git commit -m "feat(craft): add DDA voxel picking"
git push
```

---

## Verification

- [ ] Run `npx vitest run src/games3d/craft` — all seven suites pass.
- [ ] Run `npm run typecheck` — no output.
- [ ] Run `npm test` — existing 234 tests plus the new suite pass.
- [ ] Run `npm run build` — main bundle growth stays under 10 kB; these modules are not imported by any route yet, so the build should be unchanged.
- [ ] Inspect `git log --oneline -8` — one commit per task, each pushed to `origin/feat/games-wave2`.

## Self-review notes

- Spec coverage in this plan: world model, chunk size, seed determinism, four biomes, caves, ores, flora, spawn, block registry, skylight/blocklight, greedy meshing with AO, DDA picking, edit overlay for saves. Player, inventory, crafting, farming, creatures, saves, engine, UI, audio and integration belong to the next two plans and are intentionally not in this one.
- Type consistency: `BlockId` is a numeric union; `ChunkLight` arrays are indexed with `blockIndex`; `VoxelWorld` is the only stateful module and every later task consumes it through the documented methods.
- No placeholders: every task names files, interfaces, exact test assertions, commands and commit messages.
