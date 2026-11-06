export const BLOCK = {
  Air: 0,
  Bedrock: 1,
  Stone: 2,
  Cobblestone: 3,
  Dirt: 4,
  Grass: 5,
  Sand: 6,
  Gravel: 7,
  Clay: 8,
  Mud: 9,
  Emberstone: 10,
  Ash: 11,
  Moss: 12,
  RiftwoodLog: 13,
  RiftwoodLeaves: 14,
  GlowwoodLog: 15,
  GlowwoodLeaves: 16,
  Glowcap: 17,
  Reeds: 18,
  GlowKelp: 19,
  Flower: 20,
  CoalOre: 21,
  IronOre: 22,
  GoldOre: 23,
  CrystalOre: 24,
  Planks: 25,
  Workbench: 26,
  Kiln: 27,
  Torch: 28,
  Lantern: 29,
  Glass: 30,
  Gilded: 31,
  Bricks: 32,
  Water: 33,
  Lava: 34,
} as const;

export type BlockId = (typeof BLOCK)[keyof typeof BLOCK];

export type TextureKey =
  | 'stone' | 'cobblestone' | 'dirt' | 'grass_top' | 'grass_side'
  | 'sand' | 'gravel' | 'clay' | 'mud' | 'emberstone' | 'ash' | 'moss'
  | 'riftwood_top' | 'riftwood_side' | 'leaves'
  | 'glowwood_top' | 'glowwood_side' | 'glow_leaves'
  | 'glowcap' | 'reeds' | 'glowkelp' | 'flower'
  | 'coal_ore' | 'iron_ore' | 'gold_ore' | 'crystal_ore'
  | 'planks' | 'workbench_top' | 'workbench_side'
  | 'kiln_top' | 'kiln_side' | 'torch' | 'lantern'
  | 'glass' | 'gilded' | 'bricks' | 'water' | 'lava';

export interface BlockSpec {
  id: BlockId;
  name: string;
  solid: boolean;
  opaque: boolean;
  cutout: boolean;
  liquid: boolean;
  light: number;
  hardness: number;
  tool: 'none' | 'pickaxe' | 'axe' | 'shovel';
  minTier: 0 | 1 | 2 | 3;
  drop: BlockId;
  replaceable: boolean;
  textures: { top: TextureKey; bottom: TextureKey; side: TextureKey };
}

function spec(
  id: BlockId,
  name: string,
  overrides: Partial<Omit<BlockSpec, 'id' | 'name'>> = {},
): BlockSpec {
  return {
    id,
    name,
    solid: true,
    opaque: true,
    cutout: false,
    liquid: false,
    light: 0,
    hardness: 1.5,
    tool: 'pickaxe',
    minTier: 1,
    drop: id,
    replaceable: false,
    textures: { top: 'stone', bottom: 'stone', side: 'stone' },
    ...overrides,
  };
}

export const BLOCKS: Record<number, BlockSpec> = {
  [BLOCK.Air]: spec(BLOCK.Air, 'Air', {
    solid: false, opaque: false, replaceable: true, hardness: 0, tool: 'none',
    minTier: 0, drop: BLOCK.Air,
  }),
  [BLOCK.Bedrock]: spec(BLOCK.Bedrock, 'Bedrock', { hardness: Infinity, drop: BLOCK.Air }),
  [BLOCK.Stone]: spec(BLOCK.Stone, 'Stone', { drop: BLOCK.Cobblestone, hardness: 2.2 }),
  [BLOCK.Cobblestone]: spec(BLOCK.Cobblestone, 'Cobblestone', {
    textures: { top: 'cobblestone', bottom: 'cobblestone', side: 'cobblestone' },
  }),
  [BLOCK.Dirt]: spec(BLOCK.Dirt, 'Dirt', {
    tool: 'shovel', hardness: 0.6,
    textures: { top: 'dirt', bottom: 'dirt', side: 'dirt' },
  }),
  [BLOCK.Grass]: spec(BLOCK.Grass, 'Grass', {
    tool: 'shovel', hardness: 0.7, drop: BLOCK.Dirt,
    textures: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
  }),
  [BLOCK.Sand]: spec(BLOCK.Sand, 'Sand', {
    tool: 'shovel', minTier: 0, hardness: 0.5,
    textures: { top: 'sand', bottom: 'sand', side: 'sand' },
  }),
  [BLOCK.Gravel]: spec(BLOCK.Gravel, 'Gravel', {
    tool: 'shovel', minTier: 0, hardness: 0.7,
    textures: { top: 'gravel', bottom: 'gravel', side: 'gravel' },
  }),
  [BLOCK.Clay]: spec(BLOCK.Clay, 'Clay', {
    tool: 'shovel', minTier: 0, hardness: 0.6,
    textures: { top: 'clay', bottom: 'clay', side: 'clay' },
  }),
  [BLOCK.Mud]: spec(BLOCK.Mud, 'Mud', {
    tool: 'shovel', minTier: 0, hardness: 0.5,
    textures: { top: 'mud', bottom: 'mud', side: 'mud' },
  }),
  [BLOCK.Emberstone]: spec(BLOCK.Emberstone, 'Emberstone', {
    hardness: 2.0,
    textures: { top: 'emberstone', bottom: 'emberstone', side: 'emberstone' },
  }),
  [BLOCK.Ash]: spec(BLOCK.Ash, 'Ash', {
    tool: 'shovel', minTier: 0, hardness: 0.4,
    textures: { top: 'ash', bottom: 'ash', side: 'ash' },
  }),
  [BLOCK.Moss]: spec(BLOCK.Moss, 'Moss', {
    tool: 'shovel', minTier: 0, hardness: 0.5,
    textures: { top: 'moss', bottom: 'moss', side: 'moss' },
  }),
  [BLOCK.RiftwoodLog]: spec(BLOCK.RiftwoodLog, 'Riftwood Log', {
    tool: 'axe', minTier: 0, hardness: 1.8,
    textures: { top: 'riftwood_top', bottom: 'riftwood_top', side: 'riftwood_side' },
  }),
  [BLOCK.RiftwoodLeaves]: spec(BLOCK.RiftwoodLeaves, 'Riftwood Leaves', {
    opaque: false, cutout: true, tool: 'axe', minTier: 0, hardness: 0.3, drop: BLOCK.Air,
    textures: { top: 'leaves', bottom: 'leaves', side: 'leaves' },
  }),
  [BLOCK.GlowwoodLog]: spec(BLOCK.GlowwoodLog, 'Glowwood Log', {
    tool: 'axe', minTier: 0, hardness: 1.8,
    textures: { top: 'glowwood_top', bottom: 'glowwood_top', side: 'glowwood_side' },
  }),
  [BLOCK.GlowwoodLeaves]: spec(BLOCK.GlowwoodLeaves, 'Glowwood Leaves', {
    opaque: false, cutout: true, light: 6, tool: 'axe', minTier: 0, hardness: 0.3, drop: BLOCK.Air,
    textures: { top: 'glow_leaves', bottom: 'glow_leaves', side: 'glow_leaves' },
  }),
  [BLOCK.Glowcap]: spec(BLOCK.Glowcap, 'Glowcap', {
    solid: false, opaque: false, cutout: true, light: 7, tool: 'axe', minTier: 0, hardness: 0.2,
    replaceable: true,
    textures: { top: 'glowcap', bottom: 'glowcap', side: 'glowcap' },
  }),
  [BLOCK.Reeds]: spec(BLOCK.Reeds, 'Reeds', {
    solid: false, opaque: false, cutout: true, tool: 'none', minTier: 0, hardness: 0.1,
    replaceable: true,
    textures: { top: 'reeds', bottom: 'reeds', side: 'reeds' },
  }),
  [BLOCK.GlowKelp]: spec(BLOCK.GlowKelp, 'Glow Kelp', {
    solid: false, opaque: false, cutout: true, light: 4, tool: 'none', minTier: 0, hardness: 0.1,
    replaceable: true,
    textures: { top: 'glowkelp', bottom: 'glowkelp', side: 'glowkelp' },
  }),
  [BLOCK.Flower]: spec(BLOCK.Flower, 'Flower', {
    solid: false, opaque: false, cutout: true, tool: 'none', minTier: 0, hardness: 0.1,
    replaceable: true,
    textures: { top: 'flower', bottom: 'flower', side: 'flower' },
  }),
  [BLOCK.CoalOre]: spec(BLOCK.CoalOre, 'Coal Ore', {
    hardness: 2.6,
    textures: { top: 'coal_ore', bottom: 'coal_ore', side: 'coal_ore' },
  }),
  [BLOCK.IronOre]: spec(BLOCK.IronOre, 'Iron Ore', {
    minTier: 2, hardness: 3.0,
    textures: { top: 'iron_ore', bottom: 'iron_ore', side: 'iron_ore' },
  }),
  [BLOCK.GoldOre]: spec(BLOCK.GoldOre, 'Gold Ore', {
    minTier: 2, hardness: 3.2,
    textures: { top: 'gold_ore', bottom: 'gold_ore', side: 'gold_ore' },
  }),
  [BLOCK.CrystalOre]: spec(BLOCK.CrystalOre, 'Crystal Ore', {
    minTier: 2, hardness: 3.6,
    textures: { top: 'crystal_ore', bottom: 'crystal_ore', side: 'crystal_ore' },
  }),
  [BLOCK.Planks]: spec(BLOCK.Planks, 'Planks', {
    tool: 'axe', minTier: 0, hardness: 1.2,
    textures: { top: 'planks', bottom: 'planks', side: 'planks' },
  }),
  [BLOCK.Workbench]: spec(BLOCK.Workbench, 'Workbench', {
    tool: 'axe', minTier: 0, hardness: 1.2,
    textures: { top: 'workbench_top', bottom: 'workbench_top', side: 'workbench_side' },
  }),
  [BLOCK.Kiln]: spec(BLOCK.Kiln, 'Kiln', {
    hardness: 2.0,
    textures: { top: 'kiln_top', bottom: 'kiln_top', side: 'kiln_side' },
  }),
  [BLOCK.Torch]: spec(BLOCK.Torch, 'Torch', {
    solid: false, opaque: false, cutout: true, light: 12, tool: 'none', minTier: 0, hardness: 0.1,
    replaceable: true,
    textures: { top: 'torch', bottom: 'torch', side: 'torch' },
  }),
  [BLOCK.Lantern]: spec(BLOCK.Lantern, 'Lantern', {
    solid: false, opaque: false, cutout: true, light: 14, tool: 'pickaxe', minTier: 0,
    hardness: 0.3, replaceable: true,
    textures: { top: 'lantern', bottom: 'lantern', side: 'lantern' },
  }),
  [BLOCK.Glass]: spec(BLOCK.Glass, 'Glass', {
    opaque: false, cutout: true, tool: 'pickaxe', minTier: 0, hardness: 0.4, drop: BLOCK.Air,
    textures: { top: 'glass', bottom: 'glass', side: 'glass' },
  }),
  [BLOCK.Gilded]: spec(BLOCK.Gilded, 'Gilded Stone', {
    minTier: 2, hardness: 3.0,
    textures: { top: 'gilded', bottom: 'gilded', side: 'gilded' },
  }),
  [BLOCK.Bricks]: spec(BLOCK.Bricks, 'Bricks', {
    hardness: 2.0,
    textures: { top: 'bricks', bottom: 'bricks', side: 'bricks' },
  }),
  [BLOCK.Water]: spec(BLOCK.Water, 'Water', {
    solid: false, opaque: false, liquid: true, tool: 'none', minTier: 0, hardness: 0,
    drop: BLOCK.Air, replaceable: true,
    textures: { top: 'water', bottom: 'water', side: 'water' },
  }),
  [BLOCK.Lava]: spec(BLOCK.Lava, 'Lava', {
    solid: false, opaque: false, liquid: true, light: 15, tool: 'none', minTier: 0, hardness: 0,
    drop: BLOCK.Air, replaceable: true,
    textures: { top: 'lava', bottom: 'lava', side: 'lava' },
  }),
};

export function blockSpec(id: number): BlockSpec {
  return BLOCKS[id] ?? BLOCKS[BLOCK.Air];
}

export function isSolidBlock(id: number): boolean { return blockSpec(id).solid; }
export function isOpaqueBlock(id: number): boolean { return blockSpec(id).opaque; }
export function isLiquidBlock(id: number): boolean { return blockSpec(id).liquid; }
export function isCutoutBlock(id: number): boolean { return blockSpec(id).cutout; }
export function lightOf(id: number): number { return blockSpec(id).light; }
export function isReplaceable(id: number): boolean { return blockSpec(id).replaceable; }
