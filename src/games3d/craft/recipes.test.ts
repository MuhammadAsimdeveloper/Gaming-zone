import { describe, expect, it } from 'vitest';
import { BLOCK, BLOCKS } from './blocks';
import { addItem, createInventory, countItem } from './inventory';
import { ITEM, isItemId } from './items';
import {
  RECIPES,
  craft,
  getRecipe,
  missingIngredients,
  recipeStatus,
  recipesForStation,
  stationAllows,
  type Recipe,
} from './recipes';

function inventoryWith(...entries: Array<[number, number]>) {
  const inventory = createInventory();
  for (const [id, count] of entries) {
    expect(addItem(inventory, id, count)).toBe(0);
  }
  return inventory;
}

describe('recipe table', () => {
  it('ships at least 24 unique recipes across all three stations', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(24);
    expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(RECIPES.length);
    expect(recipesForStation('hand').length).toBeGreaterThan(0);
    expect(recipesForStation('workbench').length).toBeGreaterThan(0);
    expect(recipesForStation('kiln').length).toBeGreaterThan(0);
  });

  it('references only known items with positive stack-sized counts', () => {
    const known = (id: number) =>
      id !== BLOCK.Air && (isItemId(id) || Object.prototype.hasOwnProperty.call(BLOCKS, id));

    for (const recipe of RECIPES) {
      expect(recipe.output.count, recipe.id).toBeGreaterThan(0);
      expect(recipe.output.count, recipe.id).toBeLessThanOrEqual(64);
      expect(known(recipe.output.id), recipe.id).toBe(true);
      for (const ingredient of recipe.ingredients) {
        expect(ingredient.count, recipe.id).toBeGreaterThan(0);
        expect(ingredient.count, recipe.id).toBeLessThanOrEqual(64);
        expect(known(ingredient.id), recipe.id).toBe(true);
      }
    }
  });

  it('unlocks each tool tier exactly through a pickaxe recipe', () => {
    const tiers = RECIPES.filter((recipe) => recipe.unlocksToolTier !== undefined);
    expect(tiers.map((recipe) => recipe.unlocksToolTier).sort()).toEqual([1, 2, 3, 4]);
  });

  it('looks recipes up by id', () => {
    expect(getRecipe('planks-riftwood')?.output).toEqual({ id: BLOCK.Planks, count: 4 });
    expect(getRecipe('missing-recipe')).toBeUndefined();
  });
});

describe('station rules', () => {
  it('allows hand recipes everywhere and higher recipes only at their station', () => {
    expect(stationAllows('hand', 'hand')).toBe(true);
    expect(stationAllows('workbench', 'hand')).toBe(true);
    expect(stationAllows('kiln', 'hand')).toBe(true);
    expect(stationAllows('workbench', 'workbench')).toBe(true);
    expect(stationAllows('hand', 'workbench')).toBe(false);
    expect(stationAllows('kiln', 'workbench')).toBe(false);
    expect(stationAllows('kiln', 'kiln')).toBe(true);
    expect(stationAllows('workbench', 'kiln')).toBe(false);
  });

  it('reports craftable, missing and wrong-station separately', () => {
    const planks = getRecipe('planks-riftwood') as Recipe;
    expect(recipeStatus(inventoryWith([BLOCK.RiftwoodLog, 1]), planks, 'hand')).toBe('craftable');
    expect(recipeStatus(createInventory(), planks, 'hand')).toBe('missing');

    const pickaxe = getRecipe('stone-pickaxe') as Recipe;
    expect(recipeStatus(inventoryWith([BLOCK.Cobblestone, 3], [ITEM.Stick, 2]), pickaxe, 'hand'))
      .toBe('wrong-station');
    expect(recipeStatus(inventoryWith([BLOCK.Cobblestone, 2], [ITEM.Stick, 2]), pickaxe, 'workbench'))
      .toBe('missing');
  });
});

describe('crafting', () => {
  it('consumes ingredients and adds the output', () => {
    const inventory = inventoryWith([BLOCK.RiftwoodLog, 2]);
    const planks = getRecipe('planks-riftwood') as Recipe;

    expect(craft(inventory, planks, 'hand')).toEqual({ ok: true });
    expect(countItem(inventory, BLOCK.RiftwoodLog)).toBe(1);
    expect(countItem(inventory, BLOCK.Planks)).toBe(4);
  });

  it('crafts higher-tier recipes at a workbench and reports missing counts', () => {
    const inventory = inventoryWith([BLOCK.Cobblestone, 3], [ITEM.Stick, 2]);
    const pickaxe = getRecipe('stone-pickaxe') as Recipe;

    expect(craft(inventory, pickaxe, 'hand')).toMatchObject({ ok: false, reason: 'wrong-station' });
    expect(countItem(inventory, BLOCK.Cobblestone)).toBe(3);

    expect(missingIngredients(inventory, pickaxe)).toEqual([]);
    expect(craft(inventory, pickaxe, 'workbench')).toEqual({ ok: true });
    expect(countItem(inventory, ITEM.StonePickaxe)).toBe(1);
    expect(countItem(inventory, BLOCK.Cobblestone)).toBe(0);
    expect(countItem(inventory, ITEM.Stick)).toBe(0);
  });

  it('reports the missing shortfall without consuming anything', () => {
    const inventory = inventoryWith([BLOCK.Planks, 1], [ITEM.Stick, 2]);
    const pickaxe = getRecipe('wood-pickaxe') as Recipe;

    expect(missingIngredients(inventory, pickaxe)).toEqual([{ id: BLOCK.Planks, count: 2 }]);
    expect(craft(inventory, pickaxe, 'workbench')).toMatchObject({ ok: false, reason: 'missing' });
    expect(countItem(inventory, BLOCK.Planks)).toBe(1);
  });

  it('refuses to craft when the output cannot fit', () => {
    const inventory = createInventory();
    inventory.slots[0] = { id: BLOCK.RiftwoodLog, count: 2 };
    for (let index = 1; index < inventory.slots.length; index += 1) {
      inventory.slots[index] = { id: BLOCK.Dirt, count: 64 };
    }
    const planks = getRecipe('planks-riftwood') as Recipe;

    expect(craft(inventory, planks, 'hand')).toMatchObject({ ok: false, reason: 'no-room' });
    expect(countItem(inventory, BLOCK.RiftwoodLog)).toBe(2);
    expect(inventory.slots[0]).toEqual({ id: BLOCK.RiftwoodLog, count: 2 });
  });

  it('chains wood through planks, sticks and the workbench', () => {
    const inventory = inventoryWith([BLOCK.RiftwoodLog, 6]);

    for (let batch = 0; batch < 6; batch += 1) {
      expect(craft(inventory, getRecipe('planks-riftwood') as Recipe, 'hand')).toEqual({ ok: true });
    }
    expect(countItem(inventory, BLOCK.Planks)).toBe(24);
    expect(craft(inventory, getRecipe('sticks') as Recipe, 'hand')).toEqual({ ok: true });
    expect(countItem(inventory, ITEM.Stick)).toBe(4);
    expect(craft(inventory, getRecipe('workbench') as Recipe, 'hand')).toEqual({ ok: true });
    expect(countItem(inventory, BLOCK.Workbench)).toBe(1);
  });
});