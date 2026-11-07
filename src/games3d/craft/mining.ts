import { BLOCK, blockSpec } from './blocks';
import { ITEM, isToolItem, toolSpec, type ToolKind } from './items';

export interface HeldTool {
  kind: ToolKind | 'none';
  tier: 0 | 1 | 2 | 3 | 4;
}

/** Speed multiplier applied when no matching tool is held. */
const WRONG_TOOL_SPEED = 0.35;
/** Every block takes at least one game tick of effort. */
const MINIMUM_BREAK_SECONDS = 0.05;

/** Ores drop materials rather than their block form. */
const ORE_DROPS: Record<number, number> = {
  [BLOCK.CoalOre]: ITEM.Coal,
  [BLOCK.IronOre]: ITEM.RawIron,
  [BLOCK.GoldOre]: ITEM.GoldNugget,
  [BLOCK.CrystalOre]: ITEM.RiftCrystal,
};

export function heldTool(id: number | null | undefined): HeldTool {
  const tool = typeof id === 'number' ? toolSpec(id) : undefined;
  return tool ? { kind: tool.kind, tier: tool.tier } : { kind: 'none', tier: 0 };
}

export function breakSeconds(blockId: number, heldId: number | null | undefined): number {
  if (blockId === BLOCK.Air) return 0;
  const spec = blockSpec(blockId);
  if (!Number.isFinite(spec.hardness)) return Infinity;
  const tool = heldTool(heldId);
  const matching = spec.tool !== 'none' && tool.kind === spec.tool;
  const speed = matching ? 1 + tool.tier * 1.5 : WRONG_TOOL_SPEED;
  return Math.max(MINIMUM_BREAK_SECONDS, spec.hardness / speed);
}

/** A gated block needs the right tool kind at or above its required tier. */
export function canHarvest(blockId: number, heldId: number | null | undefined): boolean {
  const spec = blockSpec(blockId);
  if (!Number.isFinite(spec.hardness)) return false;
  if (spec.minTier === 0) return true;
  const tool = heldTool(heldId);
  return tool.kind === spec.tool && tool.tier >= spec.minTier;
}

export function dropFor(blockId: number, heldId: number | null | undefined): number | null {
  if (!canHarvest(blockId, heldId)) return null;
  const drop = blockSpec(blockId).drop;
  if (drop === BLOCK.Air) return null;
  return ORE_DROPS[blockId] ?? drop;
}

/** Durability points consumed by one completed break. */
export function toolWear(heldId: number | null | undefined): number {
  return typeof heldId === 'number' && isToolItem(heldId) ? 1 : 0;
}