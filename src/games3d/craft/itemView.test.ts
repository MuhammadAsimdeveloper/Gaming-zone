import { describe, expect, test } from 'vitest';
import { BLOCK } from './blocks';
import { ITEM } from './items';
import { itemLabel, itemTextureKey, itemTint } from './itemView';

describe('item presentation', () => {
  test('labels blocks and items with their registry names', () => {
    expect(itemLabel(BLOCK.Grass)).toBe('Grass');
    expect(itemLabel(BLOCK.RiftLantern)).toBe('Rift Lantern');
    expect(itemLabel(ITEM.Glowberry)).toBe('Glowberry');
    expect(itemLabel(ITEM.CrystalSword)).toBe('Crystal Sword');
  });

  test('unknown identifiers fall back to a stable label instead of throwing', () => {
    expect(itemLabel(9999)).toBe('Unknown item');
    expect(itemLabel(-1)).toBe('Unknown item');
  });

  test('placeable blocks expose their top texture for hotbar icons', () => {
    expect(itemTextureKey(BLOCK.Grass)).toBe('grass_top');
    expect(itemTextureKey(BLOCK.RiftwoodLog)).toBe('riftwood_top');
    expect(itemTextureKey(BLOCK.Workbench)).toBe('workbench_top');
  });

  test('pure items and air have no block texture', () => {
    expect(itemTextureKey(ITEM.Stick)).toBeNull();
    expect(itemTextureKey(ITEM.IronIngot)).toBeNull();
    expect(itemTextureKey(BLOCK.Air)).toBeNull();
  });

  test('tool tints follow the wood, stone, iron, crystal tier palette', () => {
    expect(itemTint(ITEM.WoodPickaxe)).toBe(0x9a6b3f);
    expect(itemTint(ITEM.StoneAxe)).toBe(0x8f949c);
    expect(itemTint(ITEM.IronSword)).toBe(0xd8dde3);
    expect(itemTint(ITEM.CrystalSword)).toBe(0x7af6d8);
  });

  test('material tints are stable and distinct', () => {
    expect(itemTint(ITEM.Coal)).toBe(0x2b2b33);
    expect(itemTint(ITEM.Glowberry)).toBe(0x5ad6c8);
    expect(itemTint(ITEM.RoastedRiftroot)).toBe(0xc8a24a);
  });
});