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
