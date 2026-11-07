import { BLOCK, isOpaqueBlock, type BlockId } from './blocks';
import { fbm2, fbm3, hashSeed, makeNoise2D, makeNoise3D, mulberry32 } from './noise';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const SEA_LEVEL = 32;
/** The generator's bedrock floor layer, which no edit may replace. */
export const BEDROCK_Y = 0;

export type BiomeId = 'plains' | 'ridge' | 'glowwood' | 'marsh';

export interface BiomeSpec {
  id: BiomeId;
  name: string;
  surface: BlockId;
  subsurface: BlockId;
}

export const BIOMES: Record<BiomeId, BiomeSpec> = {
  plains: { id: 'plains', name: 'Verdant Plains', surface: BLOCK.Grass, subsurface: BLOCK.Dirt },
  ridge: { id: 'ridge', name: 'Ember Ridge', surface: BLOCK.Emberstone, subsurface: BLOCK.Ash },
  glowwood: { id: 'glowwood', name: 'Glowwood', surface: BLOCK.Moss, subsurface: BLOCK.Dirt },
  marsh: { id: 'marsh', name: 'Rift Marsh', surface: BLOCK.Mud, subsurface: BLOCK.Clay },
};

export function blockIndex(lx: number, ly: number, lz: number): number {
  return ly * 256 + lz * 16 + lx;
}

export interface TerrainSampler {
  readonly seed: number;
  biomeAt(x: number, z: number): BiomeId;
  heightAt(x: number, z: number): number;
  blockAt(x: number, y: number, z: number): BlockId;
}

/** Candidates tried per neighbouring chunk cell when scattering flora. */
const DECOR_CANDIDATES = 12;
/** Chance a candidate column in a wooded biome grows a tree. */
const TREE_CHANCE = 0.3;
/** Chance a grass column gets a flower. */
const FLOWER_CHANCE = 1 / 24;

function decorSeed(seed: number, cx: number, cz: number): number {
  let h = seed ^ Math.imul(cx, 374761393) ^ Math.imul(cz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Writes a decoration into the chunk buffer when the world position falls inside
 * the chunk. Bedrock and existing non-air blocks are never overwritten; water may
 * only be replaced by aquatic flora (glow kelp).
 */
function place(
  chunk: Uint8Array,
  cx: number,
  cz: number,
  wx: number,
  wy: number,
  wz: number,
  id: BlockId,
  allowWater = false,
): void {
  if (wy < 0 || wy >= CHUNK_HEIGHT) return;
  const lx = wx - cx * CHUNK_SIZE;
  const lz = wz - cz * CHUNK_SIZE;
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
  const index = blockIndex(lx, wy, lz);
  const current = chunk[index];
  if (current === BLOCK.Bedrock) return;
  if (current !== BLOCK.Air && !(allowWater && current === BLOCK.Water)) return;
  chunk[index] = id;
}

function placeTree(
  chunk: Uint8Array,
  cx: number,
  cz: number,
  wx: number,
  wz: number,
  height: number,
  biome: BiomeId,
  rng: () => number,
): void {
  const glowwood = biome === 'glowwood';
  const log = glowwood ? BLOCK.GlowwoodLog : BLOCK.RiftwoodLog;
  const leaf = glowwood ? BLOCK.GlowwoodLeaves : BLOCK.RiftwoodLeaves;
  const trunkHeight = 4 + Math.floor(rng() * 3);
  const baseY = height + 1;
  const topY = baseY + trunkHeight - 1;
  if (topY + 1 >= CHUNK_HEIGHT) return;

  for (let y = baseY; y <= topY; y += 1) {
    place(chunk, cx, cz, wx, y, wz, log);
  }
  for (let layer = 0; layer < 2; layer += 1) {
    const canopyY = topY - layer;
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        place(chunk, cx, cz, wx + dx, canopyY, wz + dz, leaf);
      }
    }
  }
}

/** Scatters trees and ground flora, resolving overlaps through the 3 x 3 chunk neighbourhood. */
function decorateChunk(terrain: TerrainSampler, chunk: Uint8Array, cx: number, cz: number): void {
  for (let ncz = cz - 1; ncz <= cz + 1; ncz += 1) {
    for (let ncx = cx - 1; ncx <= cx + 1; ncx += 1) {
      const rng = mulberry32(decorSeed(terrain.seed, ncx, ncz));
      for (let i = 0; i < DECOR_CANDIDATES; i += 1) {
        const wx = ncx * CHUNK_SIZE + Math.floor(rng() * CHUNK_SIZE);
        const wz = ncz * CHUNK_SIZE + Math.floor(rng() * CHUNK_SIZE);
        const height = terrain.heightAt(wx, wz);
        const biome = terrain.biomeAt(wx, wz);
        const treeRoll = rng();
        const chance = rng();
        const surface = terrain.blockAt(wx, height, wz);

        if (
          height > SEA_LEVEL + 1
          && (biome === 'plains' || biome === 'glowwood')
          && treeRoll < TREE_CHANCE
          && isOpaqueBlock(surface)
        ) {
          placeTree(chunk, cx, cz, wx, wz, height, biome, rng);
          continue;
        }

        if (Math.abs(height - SEA_LEVEL) <= 1) {
          const above = terrain.blockAt(wx, height + 1, wz);
          if (above === BLOCK.Water) {
            const kelpHeight = 1 + Math.floor(rng() * 3);
            for (let k = 1; k <= kelpHeight; k += 1) {
              if (terrain.blockAt(wx, height + k, wz) !== BLOCK.Water) break;
              place(chunk, cx, cz, wx, height + k, wz, BLOCK.GlowKelp, true);
            }
            continue;
          }
          if (height >= SEA_LEVEL) {
            place(chunk, cx, cz, wx, height + 1, wz, BLOCK.Reeds);
            continue;
          }
        }

        if (surface === BLOCK.Moss) {
          place(chunk, cx, cz, wx, height + 1, wz, BLOCK.Glowcap);
        } else if (surface === BLOCK.Grass && chance < FLOWER_CHANCE) {
          place(chunk, cx, cz, wx, height + 1, wz, BLOCK.Flower);
        }
      }
    }
  }
}

export function createTerrain(seed: string): TerrainSampler {
  // The hashed world seed occupies offset 0; every noise field takes the next
  // sequential derived seed so the whole world stays reproducible from `seed`.
  const base = hashSeed(seed);
  const continentNoise = makeNoise2D(base + 1);
  const detailNoise = makeNoise2D(base + 2);
  const temperatureNoise = makeNoise2D(base + 3);
  const humidityNoise = makeNoise2D(base + 4);
  const caveA = makeNoise3D(base + 5);
  const oreNoise = makeNoise3D(base + 6);
  const caveB = makeNoise3D(base + 7);
  const caveC = makeNoise3D(base + 8);

  let cacheValid = false;
  let cacheX = 0;
  let cacheZ = 0;
  let cacheHeight = 0;
  let cacheBiome: BiomeId = 'plains';

  function sampleColumn(x: number, z: number): void {
    if (cacheValid && x === cacheX && z === cacheZ) return;
    const continent = fbm2(continentNoise, x / 160, z / 160, 3);
    const detail = fbm2(detailNoise, x / 48, z / 48, 4);
    cacheHeight = Math.max(8, Math.min(56, Math.round(26 + continent * 18 + detail * 10)));
    const temperature = fbm2(temperatureNoise, x / 220, z / 220, 2);
    const humidity = fbm2(humidityNoise, x / 180, z / 180, 2);
    cacheBiome = temperature > 0.25
      ? 'ridge'
      : humidity > 0.2
        ? 'marsh'
        : humidity > -0.05
          ? 'glowwood'
          : 'plains';
    cacheX = x;
    cacheZ = z;
    cacheValid = true;
  }

  function heightAt(x: number, z: number): number {
    sampleColumn(x, z);
    return cacheHeight;
  }

  function biomeAt(x: number, z: number): BiomeId {
    sampleColumn(x, z);
    return cacheBiome;
  }

  function blockAt(x: number, y: number, z: number): BlockId {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.Air;
    if (y === BEDROCK_Y) return BLOCK.Bedrock;

    sampleColumn(x, z);
    const height = cacheHeight;
    const biome = BIOMES[cacheBiome];

    if (y > height) return y <= SEA_LEVEL ? BLOCK.Water : BLOCK.Air;

    if (y > 1 && y < height - 1) {
      const a = fbm3(caveA, x / 30, y / 22, z / 30, 2);
      const b = fbm3(caveB, x / 30, y / 22, z / 30, 2);
      const tunnel = Math.abs(a) < 0.075 && Math.abs(b) < 0.09;
      const cavern = y < 28 && fbm3(caveC, x / 48, y / 34, z / 48, 3) > 0.55;
      if (tunnel || cavern) return y <= 9 && biome.id === 'ridge' ? BLOCK.Lava : BLOCK.Air;
    }

    if (y < height - 2 && y >= 2 && y <= 52) {
      const ore = fbm3(oreNoise, x / 26, y / 20, z / 26, 2);
      if (y >= 2 && y <= 18 && ore < -0.8) return BLOCK.CrystalOre;
      if (y >= 4 && y <= 24 && ore > 0.79) return BLOCK.GoldOre;
      if (y >= 8 && y <= 40 && ore < -0.66) return BLOCK.IronOre;
      if (y >= 12 && y <= 52 && ore > 0.62) return BLOCK.CoalOre;
    }

    if (y === height) return height <= SEA_LEVEL + 1 ? BLOCK.Sand : biome.surface;
    if (y >= height - 3) return biome.subsurface;
    return BLOCK.Stone;
  }

  return {
    seed: base,
    biomeAt,
    heightAt,
    blockAt,
  };
}

export function generateChunk(terrain: TerrainSampler, cx: number, cz: number): Uint8Array {
  const chunk = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      const x = originX + lx;
      const z = originZ + lz;
      for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
        chunk[blockIndex(lx, y, lz)] = terrain.blockAt(x, y, z);
      }
    }
  }
  decorateChunk(terrain, chunk, cx, cz);
  return chunk;
}

export function findSpawn(terrain: TerrainSampler): { x: number; y: number; z: number } {
  function tryColumn(x: number, z: number): { x: number; y: number; z: number } | null {
    const height = terrain.heightAt(x, z);
    if (height < SEA_LEVEL) return null;
    const y = height + 1;
    if (y + 2 >= CHUNK_HEIGHT) return null;
    if (terrain.blockAt(x, y, z) !== BLOCK.Air) return null;
    if (terrain.blockAt(x, y + 1, z) !== BLOCK.Air) return null;
    if (terrain.blockAt(x, y + 2, z) !== BLOCK.Air) return null;
    return { x, y, z };
  }

  const origin = tryColumn(0, 0);
  if (origin) return origin;

  const maxRadius = 64;
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const north = tryColumn(x, -radius);
      if (north) return north;
      const south = tryColumn(x, radius);
      if (south) return south;
    }
    for (let z = -radius + 1; z <= radius - 1; z += 1) {
      const west = tryColumn(-radius, z);
      if (west) return west;
      const east = tryColumn(radius, z);
      if (east) return east;
    }
  }

  return { x: 0, y: SEA_LEVEL + 2, z: 0 };
}
