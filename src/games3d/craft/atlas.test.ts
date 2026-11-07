import { describe, expect, it } from 'vitest';
import { buildAtlasPixels } from './atlas';
import {
  ATLAS_COLUMNS,
  ATLAS_HEIGHT,
  ATLAS_WIDTH,
  TILE_PIXELS,
  generateTexture,
  tileFor,
} from './textures';

function copyTile(pixels: Uint8ClampedArray, tile: number): Uint8ClampedArray {
  const column = tile % ATLAS_COLUMNS;
  const row = Math.floor(tile / ATLAS_COLUMNS);
  const out = new Uint8ClampedArray(TILE_PIXELS * TILE_PIXELS * 4);
  for (let y = 0; y < TILE_PIXELS; y += 1) {
    const source = ((row * TILE_PIXELS + y) * ATLAS_WIDTH + column * TILE_PIXELS) * 4;
    out.set(pixels.subarray(source, source + TILE_PIXELS * 4), y * TILE_PIXELS * 4);
  }
  return out;
}

describe('buildAtlasPixels', () => {
  it('produces a full RGBA atlas', () => {
    const pixels = buildAtlasPixels();
    expect(pixels.length).toBe(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
  });

  it('packs each texture at the atlas origin the mesher addresses', () => {
    const pixels = buildAtlasPixels();
    for (const key of ['stone', 'water', 'glowberry_3', 'rift_lantern'] as const) {
      expect(Array.from(copyTile(pixels, tileFor(key)))).toEqual(
        Array.from(generateTexture(key)),
      );
    }
  });

  it('keeps cutout alpha instead of flattening it', () => {
    const pixels = buildAtlasPixels();
    const leaves = copyTile(pixels, tileFor('leaves'));
    let transparent = 0;
    for (let index = 3; index < leaves.length; index += 4) {
      if (leaves[index] === 0) transparent += 1;
    }
    expect(transparent).toBeGreaterThan(0);
  });

  it('is deterministic and leaves unused tiles empty', () => {
    expect(Array.from(buildAtlasPixels())).toEqual(Array.from(buildAtlasPixels()));
    const unused = buildAtlasPixels();
    // 49 texture keys live in a 64-tile atlas; the tail is never written.
    const tail = copyTile(unused, 63);
    expect(Array.from(tail).every((value) => value === 0)).toBe(true);
  });
});