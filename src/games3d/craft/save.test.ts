import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { INVENTORY_SIZE } from './inventory';
import { ITEM } from './items';
import {
  SAVE_SCHEMA_VERSION,
  createSave,
  decodeSave,
  encodeSave,
  type SaveRecord,
} from './save';

const NOW = 1_760_000_000_000;

function emptyInventory(): Array<{ id: number; count: number } | null> {
  return Array.from({ length: INVENTORY_SIZE }, () => null);
}

function sample(overrides: Partial<SaveRecord> = {}): SaveRecord {
  return {
    schema: SAVE_SCHEMA_VERSION,
    slot: 1,
    name: 'First Rift',
    seed: 'neon-rift',
    createdAt: NOW,
    updatedAt: NOW,
    playSeconds: 0,
    day: 1,
    timeOfDay: 0,
    player: {
      position: { x: 0.5, y: 40, z: 0.5 },
      yaw: 0,
      pitch: 0,
      health: 20,
      hunger: 20,
      inventory: emptyInventory(),
      selected: 0,
    },
    edits: [],
    stats: { blocksMined: 0, blocksPlaced: 0, creaturesDefeated: 0, deaths: 0 },
    ...overrides,
  };
}

describe('save codec', () => {
  it('round-trips a complete save', () => {
    const record = sample();
    record.player.inventory[0] = { id: ITEM.WoodPickaxe, count: 1, durability: 42 };
    record.player.inventory[1] = { id: BLOCK.Dirt, count: 64 };
    record.edits = [
      { x: 4, y: 30, z: -8, block: BLOCK.Stone },
      { x: 4, y: 31, z: -8, block: BLOCK.Air },
    ];
    record.stats.blocksMined = 12;
    record.day = 3;
    record.timeOfDay = 500;

    const decoded = decodeSave(encodeSave(record));
    expect(decoded).toEqual({ ok: true, record });
  });

  it('creates a fresh save at the spawn point', () => {
    const record = createSave({
      slot: 2,
      name: 'New World',
      seed: 'rift-42',
      now: NOW,
      spawn: { x: 8.5, y: 42, z: -3.5 },
    });

    expect(record.schema).toBe(SAVE_SCHEMA_VERSION);
    expect(record.slot).toBe(2);
    expect(record.day).toBe(1);
    expect(record.timeOfDay).toBe(0);
    expect(record.player.position).toEqual({ x: 8.5, y: 42, z: -3.5 });
    expect(record.player.health).toBe(20);
    expect(record.player.hunger).toBe(20);
    expect(record.player.inventory).toHaveLength(INVENTORY_SIZE);
    expect(record.player.inventory.every((slot) => slot === null)).toBe(true);
    expect(record.edits).toEqual([]);
  });

  it('marks corrupt JSON as unreadable instead of repairing it', () => {
    const result = decodeSave('{"slot":1,');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unreadable');
      expect(result.detail.length).toBeGreaterThan(0);
    }
  });

  it('rejects an unsupported schema version', () => {
    const result = decodeSave(JSON.stringify({ ...sample(), schema: 99 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toMatch(/schema/i);
  });

  it('rejects out-of-range player, slot and clock values', () => {
    const cases = [
      sample({ slot: 4 as SaveRecord['slot'] }),
      sample({ day: 0 }),
      sample({ timeOfDay: 720 }),
      sample({ player: { ...sample().player, health: 21 } }),
      sample({ player: { ...sample().player, hunger: -1 } }),
      sample({ player: { ...sample().player, selected: 9 } }),
      sample({ player: { ...sample().player, position: { x: Number.NaN, y: 40, z: 0 } } }),
    ];
    for (const record of cases) {
      expect(decodeSave(JSON.stringify(record)).ok).toBe(false);
    }
  });

  it('rejects malformed inventory stacks', () => {
    const invalidStacks = [
      { id: 0, count: 1 },
      { id: ITEM.Coal, count: 0 },
      { id: ITEM.Coal, count: 65 },
      { id: ITEM.Coal, count: 1.5 },
      { id: ITEM.WoodPickaxe, count: 1, durability: -3 },
      { id: 9_999, count: 1 },
    ];
    for (const stack of invalidStacks) {
      const record = sample();
      record.player.inventory[0] = stack;
      expect(decodeSave(JSON.stringify(record)).ok).toBe(false);
    }
  });

  it('rejects malformed block edits', () => {
    const invalidEdits = [
      [{ x: 0.5, y: 20, z: 0, block: BLOCK.Stone }],
      [{ x: 0, y: 64, z: 0, block: BLOCK.Stone }],
      [{ x: 0, y: 20, z: 0, block: 200 }],
      [{ x: 0, y: 20, z: 0 }],
      'not-an-array',
    ];
    for (const edits of invalidEdits) {
      expect(decodeSave(JSON.stringify({ ...sample(), edits })).ok).toBe(false);
    }
  });

  it('rejects a payload that is not an object', () => {
    expect(decodeSave('null').ok).toBe(false);
    expect(decodeSave('42').ok).toBe(false);
    expect(decodeSave('"save"').ok).toBe(false);
  });
});