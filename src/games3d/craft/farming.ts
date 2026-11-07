import { BLOCK, type BlockId } from './blocks';
import { ITEM } from './items';

export type CropKind = 'glowberry' | 'riftroot';

export interface CropDefinition {
  kind: CropKind;
  seed: number;
  produce: number;
  /** Four visible growth stages, from sprout to ripe. */
  stages: readonly BlockId[];
  /** Index of the stage that can be harvested. */
  matureStage: number;
  growDays: number;
}

export const IRRIGATION_RADIUS = 4;
export const CROP_MIN_LIGHT = 8;

export const CROPS: Record<CropKind, CropDefinition> = {
  glowberry: {
    kind: 'glowberry',
    seed: ITEM.GlowberrySeeds,
    produce: ITEM.Glowberry,
    stages: [
      BLOCK.GlowberryCrop0,
      BLOCK.GlowberryCrop1,
      BLOCK.GlowberryCrop2,
      BLOCK.GlowberryCrop3,
    ],
    matureStage: 2,
    growDays: 2,
  },
  riftroot: {
    kind: 'riftroot',
    seed: ITEM.RiftrootSeeds,
    produce: ITEM.Riftroot,
    stages: [
      BLOCK.RiftrootCrop0,
      BLOCK.RiftrootCrop1,
      BLOCK.RiftrootCrop2,
      BLOCK.RiftrootCrop3,
    ],
    matureStage: 3,
    growDays: 3,
  },
};

export interface BlockSource {
  getBlock(x: number, y: number, z: number): number;
}

export function cropForSeed(seedItemId: number): CropDefinition | null {
  for (const crop of Object.values(CROPS)) {
    if (crop.seed === seedItemId) return crop;
  }
  return null;
}

export function cropOfBlock(blockId: number): CropDefinition | null {
  for (const crop of Object.values(CROPS)) {
    if (crop.stages.includes(blockId as BlockId)) return crop;
  }
  return null;
}

export function cropStage(blockId: number): number {
  const crop = cropOfBlock(blockId);
  return crop === null ? -1 : crop.stages.indexOf(blockId as BlockId);
}

export function isMature(blockId: number): boolean {
  const crop = cropOfBlock(blockId);
  return crop !== null && cropStage(blockId) >= crop.matureStage;
}

export function isTillable(blockId: number): boolean {
  return blockId === BLOCK.Grass || blockId === BLOCK.Dirt;
}

export function till(blockId: number): BlockId | null {
  return isTillable(blockId) ? BLOCK.Farmland : null;
}

export function hasIrrigation(
  world: BlockSource,
  x: number,
  y: number,
  z: number,
  radius = IRRIGATION_RADIUS,
): boolean {
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dy = 0; dy <= 1; dy += 1) {
        if (world.getBlock(x + dx, y + dy, z + dz) === BLOCK.Water) return true;
      }
    }
  }
  return false;
}

export function canGrow(blockId: number, light: number): boolean {
  const crop = cropOfBlock(blockId);
  if (crop === null || light < CROP_MIN_LIGHT) return false;
  return cropStage(blockId) < crop.matureStage;
}

export function stageAfterDawn(blockId: number, light: number): BlockId | null {
  if (!canGrow(blockId, light)) return null;
  const crop = cropOfBlock(blockId);
  if (crop === null) return null;
  return crop.stages[cropStage(blockId) + 1] ?? null;
}

export interface HarvestYield {
  produce: number;
  produceCount: number;
  seeds: number;
  seedCount: number;
}

export function harvest(kind: CropKind, random: () => number = Math.random): HarvestYield {
  const crop = CROPS[kind];
  return {
    produce: crop.produce,
    produceCount: 2 + (random() < 0.5 ? 1 : 0),
    seeds: crop.seed,
    seedCount: 1 + (random() < 0.5 ? 1 : 0),
  };
}