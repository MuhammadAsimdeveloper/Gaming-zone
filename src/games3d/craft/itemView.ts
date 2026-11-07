import { BLOCK, BLOCKS, blockSpec, type TextureKey } from './blocks';
import { itemSpec } from './items';

const TOOL_TIER_TINTS = [0x9a6b3f, 0x8f949c, 0xd8dde3, 0x7af6d8] as const;

const MATERIAL_TINTS: Record<number, number> = {
  100: 0x2b2b33,
  101: 0xb07a58,
  102: 0xf0c95a,
  103: 0x6ef0c2,
  104: 0x9a6b3f,
  105: 0xd8dde3,
  106: 0x35353c,
  107: 0x8be9ff,
  108: 0xff8a4d,
  109: 0x5ad6c8,
  110: 0x9f6ad6,
  111: 0x5ad6c8,
  112: 0xc8a24a,
  113: 0x5ad6c8,
  114: 0xc8a24a,
};

export function itemLabel(id: number): string {
  const item = itemSpec(id);
  if (item) return item.name;
  if (Object.prototype.hasOwnProperty.call(BLOCKS, id)) return blockSpec(id).name;
  return 'Unknown item';
}

/** Block items render their real top texture; tools and materials use a tint. */
export function itemTextureKey(id: number): TextureKey | null {
  if (id === BLOCK.Air) return null;
  if (!Object.prototype.hasOwnProperty.call(BLOCKS, id)) return null;
  return blockSpec(id).textures.top;
}

export function itemTint(id: number): number {
  const tool = itemSpec(id)?.tool;
  if (tool) return TOOL_TIER_TINTS[tool.tier - 1]!;
  return MATERIAL_TINTS[id] ?? 0xb9bec5;
}