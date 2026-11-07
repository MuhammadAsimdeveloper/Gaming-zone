import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { ITEM } from './items';
import {
  CROPS,
  IRRIGATION_RADIUS,
  canGrow,
  cropForSeed,
  cropOfBlock,
  harvest,
  hasIrrigation,
  isMature,
  isTillable,
  stageAfterDawn,
  till,
} from './farming';

function waterAt(wx: number, wy: number, wz: number) {
  return {
    getBlock(x: number, y: number, z: number): number {
      return x === wx && y === wy && z === wz ? BLOCK.Water : BLOCK.Dirt;
    },
  };
}

describe('farming rules', () => {
  it('defines four visible stages and a maturity stage for both crops', () => {
    for (const crop of Object.values(CROPS)) {
      expect(crop.stages).toHaveLength(4);
      expect(crop.matureStage).toBeLessThan(crop.stages.length);
      expect(crop.produce).toBeGreaterThanOrEqual(100);
    }
    expect(CROPS.glowberry.growDays).toBe(2);
    expect(CROPS.riftroot.growDays).toBe(3);
    expect(CROPS.glowberry.matureStage).toBe(2);
    expect(CROPS.riftroot.matureStage).toBe(3);
  });

  it('maps seeds to their first growth stage', () => {
    expect(cropForSeed(ITEM.GlowberrySeeds)?.stages[0]).toBe(BLOCK.GlowberryCrop0);
    expect(cropForSeed(ITEM.RiftrootSeeds)?.stages[0]).toBe(BLOCK.RiftrootCrop0);
    expect(cropForSeed(ITEM.Coal)).toBeNull();
    expect(cropOfBlock(BLOCK.GlowberryCrop2)?.kind).toBe('glowberry');
    expect(cropOfBlock(BLOCK.Dirt)).toBeNull();
  });

  it('tills only grass and dirt', () => {
    expect(isTillable(BLOCK.Grass)).toBe(true);
    expect(isTillable(BLOCK.Dirt)).toBe(true);
    expect(isTillable(BLOCK.Stone)).toBe(false);
    expect(isTillable(BLOCK.Farmland)).toBe(false);
    expect(till(BLOCK.Grass)).toBe(BLOCK.Farmland);
    expect(till(BLOCK.Dirt)).toBe(BLOCK.Farmland);
    expect(till(BLOCK.Stone)).toBeNull();
  });

  it('counts water within four blocks as irrigation', () => {
    expect(IRRIGATION_RADIUS).toBe(4);
    expect(hasIrrigation(waterAt(4, 0, 0), 0, 0, 0)).toBe(true);
    expect(hasIrrigation(waterAt(0, 1, 4), 0, 0, 0)).toBe(true);
    expect(hasIrrigation(waterAt(5, 0, 0), 0, 0, 0)).toBe(false);
    expect(hasIrrigation(waterAt(4, 3, 0), 0, 0, 0)).toBe(false);
  });

  it('requires light eight or higher to grow', () => {
    expect(canGrow(BLOCK.GlowberryCrop0, 7)).toBe(false);
    expect(canGrow(BLOCK.GlowberryCrop0, 8)).toBe(true);
    expect(stageAfterDawn(BLOCK.GlowberryCrop0, 7)).toBeNull();
    expect(stageAfterDawn(BLOCK.GlowberryCrop0, 8)).toBe(BLOCK.GlowberryCrop1);
  });

  it('matures glowberry after two dawns and riftroot after three', () => {
    let glow = stageAfterDawn(BLOCK.GlowberryCrop0, 10);
    expect(glow).toBe(BLOCK.GlowberryCrop1);
    expect(isMature(glow!)).toBe(false);
    glow = stageAfterDawn(glow!, 10);
    expect(glow).toBe(BLOCK.GlowberryCrop2);
    expect(isMature(glow!)).toBe(true);
    expect(stageAfterDawn(glow!, 10)).toBeNull();

    let root: number = BLOCK.RiftrootCrop0;
    for (let dawn = 1; dawn <= 3; dawn += 1) {
      const next = stageAfterDawn(root, 10);
      expect(next).not.toBeNull();
      root = next!;
      expect(isMature(root)).toBe(dawn === 3);
    }
    expect(root).toBe(BLOCK.RiftrootCrop3);
  });

  it('does not grow crops starved of light or already mature', () => {
    expect(stageAfterDawn(BLOCK.RiftrootCrop2, 0)).toBeNull();
    expect(stageAfterDawn(BLOCK.RiftrootCrop3, 15)).toBeNull();
    expect(canGrow(BLOCK.RiftrootCrop3, 15)).toBe(false);
    expect(stageAfterDawn(BLOCK.Dirt, 15)).toBeNull();
  });

  it('harvests two to three produce and one to two seeds', () => {
    const rich = harvest('glowberry', () => 0.1);
    expect(rich).toEqual({ produce: ITEM.Glowberry, produceCount: 3, seeds: ITEM.GlowberrySeeds, seedCount: 2 });

    const lean = harvest('riftroot', () => 0.9);
    expect(lean).toEqual({ produce: ITEM.Riftroot, produceCount: 2, seeds: ITEM.RiftrootSeeds, seedCount: 1 });
  });
});