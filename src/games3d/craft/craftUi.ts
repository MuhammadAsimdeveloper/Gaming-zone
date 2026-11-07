import type { CraftInventoryItem } from './engine';
import type { Inventory } from './inventory';

export function formatPlaytime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  return `${minutes}m`;
}

export function formatUpdated(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Never';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function randomSeed(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let index = 0; index < 6; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `rift-${suffix}`;
}

export function detectTouch(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

export function viewToInventory(view: {
  slots: Array<CraftInventoryItem | null>;
  selected: number;
}): Inventory {
  return {
    slots: view.slots.map((slot) =>
      slot === null
        ? null
        : slot.durability === undefined
          ? { id: slot.id, count: slot.count }
          : { id: slot.id, count: slot.count, durability: slot.durability },
    ),
    selected: view.selected,
  };
}