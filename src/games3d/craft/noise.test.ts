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
