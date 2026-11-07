import { BLOCK } from './blocks';
import { addItem, countItem, removeItem, type Inventory } from './inventory';
import { ITEM } from './items';

export type Station = 'hand' | 'workbench' | 'kiln';

export interface Ingredient {
  id: number;
  count: number;
}

export interface Recipe {
  id: string;
  name: string;
  station: Station;
  ingredients: Ingredient[];
  output: Ingredient;
  /** Highest pickaxe tier this recipe unlocks, when it unlocks one. */
  unlocksToolTier?: 1 | 2 | 3 | 4;
}

export type CraftStatus = 'craftable' | 'missing' | 'wrong-station';

export type CraftResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-station' }
  | { ok: false; reason: 'missing'; missing: Ingredient[] }
  | { ok: false; reason: 'no-room' };

function recipe(
  id: string,
  name: string,
  station: Station,
  ingredients: Ingredient[],
  output: Ingredient,
  unlocksToolTier?: 1 | 2 | 3 | 4,
): Recipe {
  return { id, name, station, ingredients, output, ...(unlocksToolTier ? { unlocksToolTier } : {}) };
}

const LOG = BLOCK.RiftwoodLog;
const PLANKS = BLOCK.Planks;
const STICK = ITEM.Stick;

/** Hand tools: the same shape repeated per tier, with the material swapped. */
function toolSet(
  tier: 'wood' | 'stone' | 'iron' | 'crystal',
  materialId: number,
  station: Station,
  pickaxe: number,
  axe: number,
  shovel: number,
  sword: number,
  hoe: number | null,
  toolTier: 1 | 2 | 3 | 4,
): Recipe[] {
  const label = tier[0]!.toUpperCase() + tier.slice(1);
  const recipes = [
    recipe(`${tier}-pickaxe`, `${label} Pickaxe`, station,
      [{ id: materialId, count: 3 }, { id: STICK, count: 2 }], { id: pickaxe, count: 1 }, toolTier),
    recipe(`${tier}-axe`, `${label} Axe`, station,
      [{ id: materialId, count: 3 }, { id: STICK, count: 2 }], { id: axe, count: 1 }),
    recipe(`${tier}-shovel`, `${label} Shovel`, station,
      [{ id: materialId, count: 1 }, { id: STICK, count: 2 }], { id: shovel, count: 1 }),
    recipe(`${tier}-sword`, `${label} Sword`, station,
      [{ id: materialId, count: 2 }, { id: STICK, count: 1 }], { id: sword, count: 1 }),
  ];
  if (hoe !== null) {
    recipes.push(
      recipe(`${tier}-hoe`, `${label} Hoe`, station,
        [{ id: materialId, count: 2 }, { id: STICK, count: 2 }], { id: hoe, count: 1 }),
    );
  }
  return recipes;
}

export const RECIPES: readonly Recipe[] = [
  recipe('planks-riftwood', 'Riftwood Planks', 'hand', [{ id: LOG, count: 1 }], { id: PLANKS, count: 4 }),
  recipe('planks-glowwood', 'Glowwood Planks', 'hand',
    [{ id: BLOCK.GlowwoodLog, count: 1 }], { id: PLANKS, count: 4 }),
  recipe('sticks', 'Sticks', 'hand', [{ id: PLANKS, count: 2 }], { id: STICK, count: 4 }),
  recipe('workbench', 'Workbench', 'hand', [{ id: PLANKS, count: 4 }], { id: BLOCK.Workbench, count: 1 }),
  recipe('torches', 'Torches', 'hand',
    [{ id: STICK, count: 1 }, { id: ITEM.Coal, count: 1 }], { id: BLOCK.Torch, count: 2 }),

  ...toolSet('wood', PLANKS, 'hand',
    ITEM.WoodPickaxe, ITEM.WoodAxe, ITEM.WoodShovel, ITEM.WoodSword, ITEM.WoodHoe, 1),
  ...toolSet('stone', BLOCK.Cobblestone, 'workbench',
    ITEM.StonePickaxe, ITEM.StoneAxe, ITEM.StoneShovel, ITEM.StoneSword, ITEM.StoneHoe, 2),
  ...toolSet('iron', ITEM.IronIngot, 'workbench',
    ITEM.IronPickaxe, ITEM.IronAxe, ITEM.IronShovel, ITEM.IronSword, ITEM.IronHoe, 3),
  ...toolSet('crystal', ITEM.RiftCrystal, 'workbench',
    ITEM.CrystalPickaxe, ITEM.CrystalAxe, ITEM.CrystalShovel, ITEM.CrystalSword, null, 4),

  recipe('lantern', 'Lantern', 'workbench',
    [{ id: ITEM.GlowDust, count: 1 }, { id: ITEM.IronIngot, count: 1 }],
    { id: BLOCK.Lantern, count: 1 }),
  recipe('bricks', 'Bricks', 'workbench',
    [{ id: BLOCK.Clay, count: 4 }], { id: BLOCK.Bricks, count: 2 }),
  recipe('gilded', 'Gilded Stone', 'workbench',
    [{ id: ITEM.GoldNugget, count: 4 }, { id: BLOCK.Stone, count: 1 }], { id: BLOCK.Gilded, count: 1 }),

  recipe('iron-ingot', 'Iron Ingot', 'kiln',
    [{ id: ITEM.RawIron, count: 1 }], { id: ITEM.IronIngot, count: 1 }),
  recipe('glass', 'Glass', 'kiln', [{ id: BLOCK.Sand, count: 1 }], { id: BLOCK.Glass, count: 1 }),
  recipe('charcoal', 'Charcoal', 'kiln', [{ id: LOG, count: 1 }], { id: ITEM.Charcoal, count: 1 }),
  recipe('roasted-glowberry', 'Roasted Glowberry', 'kiln',
    [{ id: ITEM.Glowberry, count: 1 }], { id: ITEM.RoastedGlowberry, count: 1 }),
  recipe('roasted-riftroot', 'Roasted Riftroot', 'kiln',
    [{ id: ITEM.Riftroot, count: 1 }], { id: ITEM.RoastedRiftroot, count: 1 }),
  recipe('rift-lantern', 'Rift Lantern', 'kiln',
    [{ id: BLOCK.Lantern, count: 1 }, { id: ITEM.EmberShard, count: 2 }, { id: ITEM.RiftCrystal, count: 1 }],
    { id: BLOCK.RiftLantern, count: 1 }),
];

const RECIPE_BY_ID = new Map(RECIPES.map((entry) => [entry.id, entry]));

export function getRecipe(id: string): Recipe | undefined {
  return RECIPE_BY_ID.get(id);
}

export function recipesForStation(station: Station): Recipe[] {
  return RECIPES.filter((entry) => entry.station === station);
}

/** Hand recipes work anywhere; a higher recipe needs its own station. */
export function stationAllows(craftingStation: Station, required: Station): boolean {
  if (required === 'hand') return true;
  return craftingStation === required;
}

export function missingIngredients(inventory: Inventory, recipe: Recipe): Ingredient[] {
  const missing: Ingredient[] = [];
  for (const ingredient of recipe.ingredients) {
    const shortfall = ingredient.count - countItem(inventory, ingredient.id);
    if (shortfall > 0) missing.push({ id: ingredient.id, count: shortfall });
  }
  return missing;
}

export function recipeStatus(
  inventory: Inventory,
  recipe: Recipe,
  station: Station,
): CraftStatus {
  if (!stationAllows(station, recipe.station)) return 'wrong-station';
  return missingIngredients(inventory, recipe).length === 0 ? 'craftable' : 'missing';
}

/**
 * Crafts atomically: a dry run on a copy proves the output fits after the ingredients are
 * consumed, then the real inventory is mutated.
 */
export function craft(inventory: Inventory, recipe: Recipe, station: Station): CraftResult {
  if (!stationAllows(station, recipe.station)) return { ok: false, reason: 'wrong-station' };
  const missing = missingIngredients(inventory, recipe);
  if (missing.length > 0) return { ok: false, reason: 'missing', missing };

  const preview: Inventory = {
    slots: inventory.slots.map((slot) => (slot ? { ...slot } : null)),
    selected: inventory.selected,
  };
  for (const ingredient of recipe.ingredients) {
    removeItem(preview, ingredient.id, ingredient.count);
  }
  if (addItem(preview, recipe.output.id, recipe.output.count) > 0) {
    return { ok: false, reason: 'no-room' };
  }

  for (const ingredient of recipe.ingredients) {
    removeItem(inventory, ingredient.id, ingredient.count);
  }
  addItem(inventory, recipe.output.id, recipe.output.count);
  return { ok: true };
}