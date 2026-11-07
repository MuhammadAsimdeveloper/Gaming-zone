import { describe, expect, it } from 'vitest';
import { BLOCKS, type TextureKey } from './blocks';
import {
  ATLAS_COLUMNS,
  ATLAS_HEIGHT,
  ATLAS_ROWS,
  ATLAS_WIDTH,
  TEXTURE_KEYS,
  TILE_PIXELS,
  atlasUvRange,
  generateTexture,
  tileFor,
} from './textures';

function alphaValues(key: TextureKey): number[] {
  const data = generateTexture(key);
  const alpha: number[] = [];
  for (let index = 3; index < data.length; index += 4) alpha.push(data[index]!);
  return alpha;
}

describe('texture atlas', () => {
  it('assigns every texture key a unique tile that fits the atlas', () => {
    expect(new Set(TEXTURE_KEYS).size).toBe(TEXTURE_KEYS.length);
    expect(TEXTURE_KEYS.length).toBeLessThanOrEqual(ATLAS_COLUMNS * ATLAS_ROWS);
    const tiles = new Set(TEXTURE_KEYS.map((key) => tileFor(key)));
    expect(tiles.size).toBe(TEXTURE_KEYS.length);
    for (const tile of tiles) {
      expect(tile).toBeGreaterThanOrEqual(0);
      expect(tile).toBeLessThan(ATLAS_COLUMNS * ATLAS_ROWS);
    }
    expect(tileFor('stone')).toBe(tileFor('stone'));
    expect(tileFor('stone')).not.toBe(tileFor('dirt'));
  });

  it('covers every texture referenced by the block registry', () => {
    const used = new Set<TextureKey>();
    for (const block of Object.values(BLOCKS)) {
      used.add(block.textures.top);
      used.add(block.textures.bottom);
      used.add(block.textures.side);
    }
    for (const key of used) expect(TEXTURE_KEYS).toContain(key);
  });

  it('generates deterministic RGBA pixels', () => {
    const first = generateTexture('grass_top');
    const second = generateTexture('grass_top');
    expect(first).toHaveLength(TILE_PIXELS * TILE_PIXELS * 4);
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(Array.from(first)).not.toEqual(Array.from(generateTexture('sand')));
  });

  it('keeps stone opaque and leaves cutout holes', () => {
    expect(alphaValues('stone').every((value) => value === 255)).toBe(true);
    expect(alphaValues('leaves').some((value) => value === 0)).toBe(true);
    expect(alphaValues('glowberry_2').some((value) => value === 0)).toBe(true);
  });

  it('renders glass and water as see-through tiles', () => {
    const glass = alphaValues('glass');
    expect(Math.max(...glass)).toBeLessThan(255);
    const water = alphaValues('water');
    expect(Math.max(...water)).toBeLessThan(255);
    expect(Math.min(...water)).toBeGreaterThan(0);
  });

  it('lays tiles out across the atlas and insets their UVs', () => {
    expect(ATLAS_COLUMNS).toBe(8);
    expect(ATLAS_ROWS).toBe(8);
    expect(TILE_PIXELS).toBe(16);
    expect(ATLAS_WIDTH).toBe(128);
    expect(ATLAS_HEIGHT).toBe(128);

    const first = atlasUvRange(0);
    expect(first.u0).toBeCloseTo(0.5 / 128);
    expect(first.v0).toBeCloseTo(0.5 / 128);
    expect(first.u1).toBeCloseTo(15.5 / 128);
    expect(first.v1).toBeCloseTo(15.5 / 128);

    const nextRow = atlasUvRange(ATLAS_COLUMNS + 1);
    expect(nextRow.u0).toBeCloseTo(16.5 / 128);
    expect(nextRow.v0).toBeCloseTo(16.5 / 128);
  });
});