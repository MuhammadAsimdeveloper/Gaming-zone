import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { ITEM } from './items';
import { breakSeconds, canHarvest, dropFor, heldTool, toolWear } from './mining';

describe('mining rules', () => {
  it('reads the held tool', () => {
    expect(heldTool(null)).toEqual({ kind: 'none', tier: 0 });
    expect(heldTool(BLOCK.Planks)).toEqual({ kind: 'none', tier: 0 });
    expect(heldTool(ITEM.WoodPickaxe)).toEqual({ kind: 'pickaxe', tier: 1 });
    expect(heldTool(ITEM.CrystalAxe)).toEqual({ kind: 'axe', tier: 4 });
  });

  it('speeds up a matching tool kind by tier', () => {
    const hand = breakSeconds(BLOCK.Stone, null);
    const wood = breakSeconds(BLOCK.Stone, ITEM.WoodPickaxe);
    const crystal = breakSeconds(BLOCK.Stone, ITEM.CrystalPickaxe);

    expect(hand).toBeGreaterThan(wood);
    expect(wood).toBeGreaterThan(crystal);
    expect(wood).toBeCloseTo(2.2 / 2.5, 6);
    expect(crystal).toBeCloseTo(2.2 / 7, 6);
  });

  it('treats the wrong tool kind as slow and unable to harvest gated blocks', () => {
    expect(breakSeconds(BLOCK.Stone, ITEM.WoodAxe))
      .toBeCloseTo(breakSeconds(BLOCK.Stone, null), 6);
    expect(canHarvest(BLOCK.Stone, null)).toBe(false);
    expect(canHarvest(BLOCK.Stone, ITEM.WoodAxe)).toBe(false);
    expect(canHarvest(BLOCK.Stone, ITEM.WoodPickaxe)).toBe(true);
  });

  it('gates ores by pickaxe tier and returns item drops', () => {
    expect(canHarvest(BLOCK.IronOre, ITEM.WoodPickaxe)).toBe(false);
    expect(dropFor(BLOCK.IronOre, ITEM.WoodPickaxe)).toBeNull();
    expect(canHarvest(BLOCK.IronOre, ITEM.StonePickaxe)).toBe(true);
    expect(dropFor(BLOCK.IronOre, ITEM.StonePickaxe)).toBe(ITEM.RawIron);
    expect(dropFor(BLOCK.CoalOre, ITEM.WoodPickaxe)).toBe(ITEM.Coal);
    expect(dropFor(BLOCK.GoldOre, ITEM.StonePickaxe)).toBe(ITEM.GoldNugget);
    expect(dropFor(BLOCK.CrystalOre, ITEM.StonePickaxe)).toBe(ITEM.RiftCrystal);
  });

  it('drops plain blocks, including the stone-to-cobblestone conversion', () => {
    expect(dropFor(BLOCK.Stone, ITEM.WoodPickaxe)).toBe(BLOCK.Cobblestone);
    expect(dropFor(BLOCK.Grass, null)).toBe(BLOCK.Dirt);
    expect(dropFor(BLOCK.GlowwoodLog, ITEM.WoodAxe)).toBe(BLOCK.GlowwoodLog);
    expect(dropFor(BLOCK.Glowcap, null)).toBe(BLOCK.Glowcap);
  });

  it('drops nothing for unbreakable, glass and leaf blocks', () => {
    expect(breakSeconds(BLOCK.Bedrock, ITEM.CrystalPickaxe)).toBe(Infinity);
    expect(canHarvest(BLOCK.Bedrock, ITEM.CrystalPickaxe)).toBe(false);
    expect(dropFor(BLOCK.Bedrock, ITEM.CrystalPickaxe)).toBeNull();
    expect(dropFor(BLOCK.Glass, ITEM.WoodPickaxe)).toBeNull();
    expect(dropFor(BLOCK.RiftwoodLeaves, null)).toBeNull();
  });

  it('never returns a break time below a single tick floor', () => {
    expect(breakSeconds(BLOCK.Flower, null)).toBeGreaterThanOrEqual(0.05);
    expect(breakSeconds(BLOCK.Air, null)).toBe(0);
  });

  it('wears only tools, one point per completed break', () => {
    expect(toolWear(null)).toBe(0);
    expect(toolWear(BLOCK.Stone)).toBe(0);
    expect(toolWear(ITEM.IronSword)).toBe(1);
  });
});