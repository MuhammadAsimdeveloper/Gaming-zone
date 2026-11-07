import { BLOCK, BLOCKS } from './blocks';
import { itemSpec } from './items';

export const HOTBAR_SIZE = 9;
export const STORAGE_SIZE = 27;
export const INVENTORY_SIZE = HOTBAR_SIZE + STORAGE_SIZE;
export const DEFAULT_STACK = 64;

export interface ItemStack {
  id: number;
  count: number;
  /** Remaining uses for tools; absent on materials and blocks. */
  durability?: number;
}

export interface Inventory {
  slots: Array<ItemStack | null>;
  /** Selected hotbar index, 0-based. */
  selected: number;
}

export function createInventory(): Inventory {
  return { slots: new Array<ItemStack | null>(INVENTORY_SIZE).fill(null), selected: 0 };
}

function isKnownId(id: number): boolean {
  if (!Number.isInteger(id) || id === BLOCK.Air) return false;
  if (itemSpec(id)) return true;
  return Object.prototype.hasOwnProperty.call(BLOCKS, id);
}

/** Tools take one slot each; every material and block stacks to 64. */
export function maxStackFor(id: number): number {
  return itemSpec(id)?.stack ?? DEFAULT_STACK;
}

function makeStack(id: number, count: number): ItemStack {
  const tool = itemSpec(id)?.tool;
  return tool ? { id, count, durability: tool.durability } : { id, count };
}

/** Adds items to existing partial stacks first, then to empty slots. Returns leftovers. */
export function addItem(inventory: Inventory, id: number, count: number): number {
  if (!isKnownId(id) || !Number.isFinite(count) || count <= 0) {
    return isKnownId(id) ? 0 : Math.max(0, Math.floor(count) || 0);
  }
  let remaining = Math.floor(count);
  const stackLimit = maxStackFor(id);

  for (const slot of inventory.slots) {
    if (remaining === 0) break;
    if (!slot || slot.id !== id) continue;
    const space = stackLimit - slot.count;
    if (space <= 0) continue;
    const moved = Math.min(space, remaining);
    slot.count += moved;
    remaining -= moved;
  }

  for (let index = 0; index < inventory.slots.length && remaining > 0; index += 1) {
    if (inventory.slots[index]) continue;
    const moved = Math.min(stackLimit, remaining);
    inventory.slots[index] = makeStack(id, moved);
    remaining -= moved;
  }

  return remaining;
}

export function countItem(inventory: Inventory, id: number): number {
  let total = 0;
  for (const slot of inventory.slots) {
    if (slot?.id === id) total += slot.count;
  }
  return total;
}

export function removeItem(inventory: Inventory, id: number, count: number): number {
  if (!isKnownId(id) || !Number.isFinite(count) || count <= 0) return 0;
  let remaining = Math.floor(count);
  const requested = remaining;
  for (let index = 0; index < inventory.slots.length && remaining > 0; index += 1) {
    const slot = inventory.slots[index];
    if (!slot || slot.id !== id) continue;
    const taken = Math.min(slot.count, remaining);
    slot.count -= taken;
    remaining -= taken;
    if (slot.count === 0) inventory.slots[index] = null;
  }
  return requested - remaining;
}

/** Moves half of a stack (rounded up) to the first empty slot. */
export function splitStack(inventory: Inventory, index: number): number {
  const slot = inventory.slots[index];
  if (!slot || slot.count < 2) return 0;
  const target = inventory.slots.indexOf(null);
  if (target < 0) return 0;
  const moved = Math.ceil(slot.count / 2);
  slot.count -= moved;
  inventory.slots[target] = makeStack(slot.id, moved);
  return moved;
}

/**
 * Moves a stack to another slot: fills an empty slot, merges into a same-id stack up to
 * its limit, or swaps with a different stack. Returns whether anything changed.
 */
export function moveStack(inventory: Inventory, from: number, to: number): boolean {
  if (from === to) return false;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
  if (from < 0 || to < 0 || from >= inventory.slots.length || to >= inventory.slots.length) {
    return false;
  }
  const source = inventory.slots[from];
  if (!source) return false;
  const target = inventory.slots[to];

  if (!target) {
    inventory.slots[to] = source;
    inventory.slots[from] = null;
    return true;
  }

  if (target.id === source.id) {
    const space = maxStackFor(target.id) - target.count;
    if (space <= 0) return false;
    const moved = Math.min(space, source.count);
    target.count += moved;
    source.count -= moved;
    if (source.count === 0) inventory.slots[from] = null;
    return true;
  }

  inventory.slots[from] = target;
  inventory.slots[to] = source;
  return true;
}

export function setSelected(inventory: Inventory, index: number): void {
  if (!Number.isFinite(index)) return;
  inventory.selected = Math.max(0, Math.min(HOTBAR_SIZE - 1, Math.trunc(index)));
}

export function heldStack(inventory: Inventory): ItemStack | null {
  return inventory.slots[inventory.selected] ?? null;
}

/** Consumes one item from the selected hotbar slot. */
export function consumeHeld(inventory: Inventory): boolean {
  const slot = inventory.slots[inventory.selected];
  if (!slot) return false;
  slot.count -= 1;
  if (slot.count <= 0) inventory.slots[inventory.selected] = null;
  return true;
}

/** Wears a tool by one use. Returns true when the tool broke and the slot cleared. */
export function damageTool(inventory: Inventory, index: number, amount = 1): boolean {
  const slot = inventory.slots[index];
  if (!slot) return false;
  const tool = itemSpec(slot.id)?.tool;
  if (!tool) return false;
  const remaining = (slot.durability ?? tool.durability) - amount;
  if (remaining <= 0) {
    inventory.slots[index] = null;
    return true;
  }
  slot.durability = remaining;
  return false;
}