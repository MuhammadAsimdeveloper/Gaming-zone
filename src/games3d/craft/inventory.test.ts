import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import {
  HOTBAR_SIZE,
  INVENTORY_SIZE,
  addItem,
  consumeHeld,
  countItem,
  createInventory,
  heldStack,
  maxStackFor,
  moveStack,
  removeItem,
  setSelected,
  splitStack,
} from './inventory';
import { ITEM, isToolItem, toolSpec } from './items';

function filled(id: number, count: number) {
  const inventory = createInventory();
  expect(addItem(inventory, id, count)).toBe(0);
  return inventory;
}

describe('inventory', () => {
  it('starts empty with 9 hotbar and 27 storage slots', () => {
    const inventory = createInventory();
    expect(INVENTORY_SIZE).toBe(36);
    expect(HOTBAR_SIZE).toBe(9);
    expect(inventory.slots).toHaveLength(INVENTORY_SIZE);
    expect(inventory.slots.every((slot) => slot === null)).toBe(true);
    expect(inventory.selected).toBe(0);
  });

  it('fills one slot up to 64 and spills into the next', () => {
    const inventory = filled(BLOCK.Cobblestone, 100);

    expect(inventory.slots[0]).toEqual({ id: BLOCK.Cobblestone, count: 64 });
    expect(inventory.slots[1]).toEqual({ id: BLOCK.Cobblestone, count: 36 });
    expect(countItem(inventory, BLOCK.Cobblestone)).toBe(100);
  });

  it('tops up partial stacks before opening new slots', () => {
    const inventory = filled(BLOCK.Planks, 40);
    addItem(inventory, BLOCK.Dirt, 5);
    addItem(inventory, BLOCK.Planks, 30);

    expect(inventory.slots[0]).toEqual({ id: BLOCK.Planks, count: 64 });
    expect(inventory.slots[1]).toEqual({ id: BLOCK.Dirt, count: 5 });
    expect(inventory.slots[2]).toEqual({ id: BLOCK.Planks, count: 6 });
  });

  it('keeps tools unstacked at one per slot', () => {
    expect(maxStackFor(ITEM.WoodPickaxe)).toBe(1);
    expect(maxStackFor(BLOCK.Stone)).toBe(64);

    const inventory = createInventory();
    addItem(inventory, ITEM.WoodPickaxe, 2);
    expect(inventory.slots[0]).toEqual({ id: ITEM.WoodPickaxe, count: 1 });
    expect(inventory.slots[1]).toEqual({ id: ITEM.WoodPickaxe, count: 1 });
  });

  it('returns unknown or invalid items as leftovers without changing slots', () => {
    const inventory = createInventory();

    expect(addItem(inventory, 9999, 5)).toBe(5);
    expect(addItem(inventory, BLOCK.Air, 3)).toBe(3);
    expect(addItem(inventory, BLOCK.Stone, 0)).toBe(0);
    expect(addItem(inventory, BLOCK.Stone, -4)).toBe(0);
    expect(inventory.slots.every((slot) => slot === null)).toBe(true);
  });

  it('removes across slots and clears emptied slots', () => {
    const inventory = filled(BLOCK.Cobblestone, 100);

    expect(removeItem(inventory, BLOCK.Cobblestone, 70)).toBe(70);
    expect(inventory.slots[0]).toBeNull();
    expect(inventory.slots[1]).toEqual({ id: BLOCK.Cobblestone, count: 30 });
    expect(removeItem(inventory, BLOCK.Cobblestone, 40)).toBe(30);
    expect(inventory.slots[0]).toBeNull();
    expect(inventory.slots[1]).toBeNull();
    expect(removeItem(inventory, BLOCK.Cobblestone, 1)).toBe(0);
  });

  it('splits a stack into the first empty slot and refuses singles', () => {
    const inventory = filled(BLOCK.Gravel, 5);
    addItem(inventory, BLOCK.Sand, 2);

    expect(splitStack(inventory, 0)).toBe(3);
    expect(inventory.slots[0]).toEqual({ id: BLOCK.Gravel, count: 2 });
    expect(inventory.slots[1]).toEqual({ id: BLOCK.Sand, count: 2 });
    expect(inventory.slots[2]).toEqual({ id: BLOCK.Gravel, count: 3 });

    expect(splitStack(inventory, 0)).toBe(1);
    expect(inventory.slots[0]).toEqual({ id: BLOCK.Gravel, count: 1 });
    expect(inventory.slots[3]).toEqual({ id: BLOCK.Gravel, count: 1 });

    expect(splitStack(inventory, 0)).toBe(0);
    expect(splitStack(inventory, 99)).toBe(0);
  });

  it('merges and swaps stacks when moving them', () => {
    const inventory = filled(BLOCK.Sand, 40);
    addItem(inventory, BLOCK.Sand, 40);

    expect(inventory.slots[0]).toEqual({ id: BLOCK.Sand, count: 64 });
    expect(inventory.slots[1]).toEqual({ id: BLOCK.Sand, count: 16 });

    expect(moveStack(inventory, 1, 2)).toBe(true);
    expect(inventory.slots[1]).toBeNull();
    expect(inventory.slots[2]).toEqual({ id: BLOCK.Sand, count: 16 });

    expect(moveStack(inventory, 2, 0)).toBe(false);
    expect(inventory.slots[0]).toEqual({ id: BLOCK.Sand, count: 64 });
    expect(inventory.slots[2]).toEqual({ id: BLOCK.Sand, count: 16 });

    addItem(inventory, BLOCK.Dirt, 1);
    expect(moveStack(inventory, 1, 2)).toBe(true);
    expect(inventory.slots[1]).toEqual({ id: BLOCK.Sand, count: 16 });
    expect(inventory.slots[2]).toEqual({ id: BLOCK.Dirt, count: 1 });

    expect(moveStack(inventory, 2, 2)).toBe(false);
    expect(moveStack(inventory, -1, 2)).toBe(false);
  });

  it('clamps the hotbar selection and consumes the held stack', () => {
    const inventory = filled(BLOCK.Planks, 2);

    setSelected(inventory, 42);
    expect(inventory.selected).toBe(HOTBAR_SIZE - 1);
    setSelected(inventory, -3);
    expect(inventory.selected).toBe(0);

    expect(inventory.slots[0]).not.toBeNull();
    inventory.slots[2] = inventory.slots[0];
    inventory.slots[0] = null;
    setSelected(inventory, 2);
    expect(inventory.selected).toBe(2);

    expect(heldStack(inventory)).toEqual({ id: BLOCK.Planks, count: 2 });
    expect(consumeHeld(inventory)).toBe(true);
    expect(heldStack(inventory)).toEqual({ id: BLOCK.Planks, count: 1 });
    expect(consumeHeld(inventory)).toBe(true);
    expect(heldStack(inventory)).toBeNull();
    expect(consumeHeld(inventory)).toBe(false);
  });
});

describe('item registry', () => {
  it('describes tool tiers, durability and stack limits', () => {
    expect(isToolItem(ITEM.WoodPickaxe)).toBe(true);
    expect(isToolItem(ITEM.Glowberry)).toBe(false);

    expect(toolSpec(ITEM.WoodPickaxe)).toMatchObject({ kind: 'pickaxe', tier: 1, durability: 60 });
    expect(toolSpec(ITEM.StonePickaxe)).toMatchObject({ tier: 2, durability: 130 });
    expect(toolSpec(ITEM.IronPickaxe)).toMatchObject({ tier: 3, durability: 250 });
    expect(toolSpec(ITEM.CrystalPickaxe)).toMatchObject({ tier: 4, durability: 500 });
    expect(toolSpec(ITEM.CrystalSword)?.attack).toBe(10);
    expect(toolSpec(ITEM.Glowberry)).toBeUndefined();
  });

  it('keeps item ids clear of block ids', () => {
    const itemIds = Object.values(ITEM);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    expect(itemIds.every((id) => id >= 100)).toBe(true);
  });
});