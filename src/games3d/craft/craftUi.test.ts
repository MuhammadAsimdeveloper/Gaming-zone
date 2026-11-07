import { describe, expect, it } from 'vitest';
import { formatPlaytime, randomSeed, viewToInventory } from './craftUi';

describe('craft UI helpers', () => {
  it('formats play time by the largest sensible unit', () => {
    expect(formatPlaytime(0)).toBe('0m');
    expect(formatPlaytime(59)).toBe('0m');
    expect(formatPlaytime(90)).toBe('1m');
    expect(formatPlaytime(3_600)).toBe('1h 00m');
    expect(formatPlaytime(7_860)).toBe('2h 11m');
  });

  it('converts the engine inventory view into a rules inventory', () => {
    const view = {
      slots: [null, { id: 100, count: 3 }, { id: 201, count: 1, durability: 42 }],
      selected: 1,
    };
    expect(viewToInventory(view)).toEqual({
      slots: [null, { id: 100, count: 3 }, { id: 201, count: 1, durability: 42 }],
      selected: 1,
    });
  });

  it('generates a readable random seed', () => {
    expect(randomSeed()).toMatch(/^rift-[a-z0-9]{6}$/);
    expect(randomSeed()).not.toBe(randomSeed());
  });
});