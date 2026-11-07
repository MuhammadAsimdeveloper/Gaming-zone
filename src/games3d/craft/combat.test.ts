import { describe, expect, it } from 'vitest';
import { MELEE_COOLDOWN, MELEE_KNOCKBACK, attackReady, knockbackVector, meleeDamage } from './combat';
import { ITEM } from './items';

describe('meleeDamage', () => {
  it('deals three damage bare-handed or with a non-sword tool', () => {
    expect(meleeDamage(null)).toBe(3);
    expect(meleeDamage(ITEM.WoodPickaxe)).toBe(3);
    expect(meleeDamage(ITEM.IronAxe)).toBe(3);
  });

  it('follows the sword tier table', () => {
    expect(meleeDamage(ITEM.WoodSword)).toBe(5);
    expect(meleeDamage(ITEM.StoneSword)).toBe(6);
    expect(meleeDamage(ITEM.IronSword)).toBe(8);
    expect(meleeDamage(ITEM.CrystalSword)).toBe(10);
  });

  it('treats a block id as unarmed damage', () => {
    expect(meleeDamage(3)).toBe(3);
  });
});

describe('attack timing', () => {
  it('allows a swing only when the cooldown has elapsed', () => {
    expect(attackReady(0)).toBe(true);
    expect(attackReady(-0.01)).toBe(true);
    expect(attackReady(0.2)).toBe(false);
    expect(MELEE_COOLDOWN).toBe(0.5);
  });

  it('pushes four metres per second along the facing direction', () => {
    const forward = knockbackVector(0);
    expect(forward.x).toBeCloseTo(0, 9);
    expect(forward.z).toBeCloseTo(-MELEE_KNOCKBACK, 9);
    const east = knockbackVector(Math.PI / 2);
    expect(east.x).toBeCloseTo(-MELEE_KNOCKBACK, 9);
    expect(east.z).toBeCloseTo(0, 9);
    expect(Math.hypot(east.x, east.z)).toBeCloseTo(MELEE_KNOCKBACK, 9);
  });
});