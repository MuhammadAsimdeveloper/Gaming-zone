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
    expect(lightOf(BLOCK.RiftLantern)).toBe(15);
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
    expect(Object.keys(BLOCKS)).toHaveLength(36);
  });
});
