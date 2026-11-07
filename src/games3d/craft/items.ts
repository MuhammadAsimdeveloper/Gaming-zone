export const ITEM = {
  Coal: 100,
  RawIron: 101,
  GoldNugget: 102,
  RiftCrystal: 103,
  Stick: 104,
  IronIngot: 105,
  Charcoal: 106,
  GlowDust: 107,
  EmberShard: 108,
  Glowberry: 109,
  RoastedGlowberry: 110,
  Riftroot: 111,
  RoastedRiftroot: 112,
  GlowberrySeeds: 113,
  RiftrootSeeds: 114,

  WoodPickaxe: 120,
  WoodAxe: 121,
  WoodShovel: 122,
  WoodSword: 123,
  WoodHoe: 124,
  StonePickaxe: 125,
  StoneAxe: 126,
  StoneShovel: 127,
  StoneSword: 128,
  StoneHoe: 129,
  IronPickaxe: 130,
  IronAxe: 131,
  IronShovel: 132,
  IronSword: 133,
  IronHoe: 134,
  CrystalPickaxe: 135,
  CrystalAxe: 136,
  CrystalShovel: 137,
  CrystalSword: 138,
} as const;

export type ItemId = (typeof ITEM)[keyof typeof ITEM];

export type ToolKind = 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe';

export interface ToolSpec {
  kind: ToolKind;
  /** 1 wood, 2 stone, 3 iron, 4 rift crystal. */
  tier: 1 | 2 | 3 | 4;
  durability: number;
  /** Melee damage; unarmed is 3. */
  attack: number;
}

export interface ItemSpec {
  id: ItemId;
  name: string;
  stack: number;
  tool?: ToolSpec;
  /** Hunger restored when eaten. */
  food?: number;
}

const DURABILITY = [60, 130, 250, 500] as const;
const TIER_NAME = ['Wood', 'Stone', 'Iron', 'Crystal'] as const;

function tool(
  id: ItemId,
  name: string,
  kind: ToolKind,
  tier: 1 | 2 | 3 | 4,
  attack: number,
): ItemSpec {
  return { id, name, stack: 1, tool: { kind, tier, durability: DURABILITY[tier - 1], attack } };
}

function material(id: ItemId, name: string, extra: Partial<ItemSpec> = {}): ItemSpec {
  return { id, name, stack: 64, ...extra };
}

export const ITEMS: Record<number, ItemSpec> = {
  [ITEM.Coal]: material(ITEM.Coal, 'Coal'),
  [ITEM.RawIron]: material(ITEM.RawIron, 'Raw Iron'),
  [ITEM.GoldNugget]: material(ITEM.GoldNugget, 'Gold Nugget'),
  [ITEM.RiftCrystal]: material(ITEM.RiftCrystal, 'Rift Crystal'),
  [ITEM.Stick]: material(ITEM.Stick, 'Stick'),
  [ITEM.IronIngot]: material(ITEM.IronIngot, 'Iron Ingot'),
  [ITEM.Charcoal]: material(ITEM.Charcoal, 'Charcoal'),
  [ITEM.GlowDust]: material(ITEM.GlowDust, 'Glow Dust'),
  [ITEM.EmberShard]: material(ITEM.EmberShard, 'Ember Shard'),
  [ITEM.Glowberry]: material(ITEM.Glowberry, 'Glowberry', { food: 2 }),
  [ITEM.RoastedGlowberry]: material(ITEM.RoastedGlowberry, 'Roasted Glowberry', { food: 5 }),
  [ITEM.Riftroot]: material(ITEM.Riftroot, 'Riftroot', { food: 3 }),
  [ITEM.RoastedRiftroot]: material(ITEM.RoastedRiftroot, 'Roasted Riftroot', { food: 6 }),
  [ITEM.GlowberrySeeds]: material(ITEM.GlowberrySeeds, 'Glowberry Seeds'),
  [ITEM.RiftrootSeeds]: material(ITEM.RiftrootSeeds, 'Riftroot Seeds'),

  [ITEM.WoodPickaxe]: tool(ITEM.WoodPickaxe, `${TIER_NAME[0]} Pickaxe`, 'pickaxe', 1, 2),
  [ITEM.WoodAxe]: tool(ITEM.WoodAxe, `${TIER_NAME[0]} Axe`, 'axe', 1, 3),
  [ITEM.WoodShovel]: tool(ITEM.WoodShovel, `${TIER_NAME[0]} Shovel`, 'shovel', 1, 2),
  [ITEM.WoodSword]: tool(ITEM.WoodSword, `${TIER_NAME[0]} Sword`, 'sword', 1, 5),
  [ITEM.WoodHoe]: tool(ITEM.WoodHoe, `${TIER_NAME[0]} Hoe`, 'hoe', 1, 1),
  [ITEM.StonePickaxe]: tool(ITEM.StonePickaxe, `${TIER_NAME[1]} Pickaxe`, 'pickaxe', 2, 3),
  [ITEM.StoneAxe]: tool(ITEM.StoneAxe, `${TIER_NAME[1]} Axe`, 'axe', 2, 4),
  [ITEM.StoneShovel]: tool(ITEM.StoneShovel, `${TIER_NAME[1]} Shovel`, 'shovel', 2, 3),
  [ITEM.StoneSword]: tool(ITEM.StoneSword, `${TIER_NAME[1]} Sword`, 'sword', 2, 6),
  [ITEM.StoneHoe]: tool(ITEM.StoneHoe, `${TIER_NAME[1]} Hoe`, 'hoe', 2, 2),
  [ITEM.IronPickaxe]: tool(ITEM.IronPickaxe, `${TIER_NAME[2]} Pickaxe`, 'pickaxe', 3, 4),
  [ITEM.IronAxe]: tool(ITEM.IronAxe, `${TIER_NAME[2]} Axe`, 'axe', 3, 5),
  [ITEM.IronShovel]: tool(ITEM.IronShovel, `${TIER_NAME[2]} Shovel`, 'shovel', 3, 4),
  [ITEM.IronSword]: tool(ITEM.IronSword, `${TIER_NAME[2]} Sword`, 'sword', 3, 8),
  [ITEM.IronHoe]: tool(ITEM.IronHoe, `${TIER_NAME[2]} Hoe`, 'hoe', 3, 3),
  [ITEM.CrystalPickaxe]: tool(ITEM.CrystalPickaxe, `${TIER_NAME[3]} Pickaxe`, 'pickaxe', 4, 5),
  [ITEM.CrystalAxe]: tool(ITEM.CrystalAxe, `${TIER_NAME[3]} Axe`, 'axe', 4, 6),
  [ITEM.CrystalShovel]: tool(ITEM.CrystalShovel, `${TIER_NAME[3]} Shovel`, 'shovel', 4, 5),
  [ITEM.CrystalSword]: tool(ITEM.CrystalSword, `${TIER_NAME[3]} Sword`, 'sword', 4, 10),
};

export function isItemId(id: number): id is ItemId {
  return Object.prototype.hasOwnProperty.call(ITEMS, id);
}

export function itemSpec(id: number): ItemSpec | undefined {
  return ITEMS[id];
}

export function isToolItem(id: number): boolean {
  return itemSpec(id)?.tool !== undefined;
}

export function toolSpec(id: number): ToolSpec | undefined {
  return itemSpec(id)?.tool;
}

export const UNARMED_DAMAGE = 3;
export const SWORD_DAMAGE: Record<1 | 2 | 3 | 4, number> = { 1: 5, 2: 6, 3: 8, 4: 10 };
