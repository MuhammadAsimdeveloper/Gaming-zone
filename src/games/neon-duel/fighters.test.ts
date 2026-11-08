import { describe, expect, it } from 'vitest';
import { DUEL_LADDER, FIGHTERS, FIGHTER_ORDER, type FighterId, type MoveId } from './fighters';

const MOVES: MoveId[] = ['light', 'heavy', 'special'];

describe('fighter roster', () => {
  it('defines four fighters in a fixed order', () => {
    expect(FIGHTER_ORDER).toEqual(['volt', 'kestrel', 'mako', 'sable']);
    for (const id of FIGHTER_ORDER) {
      const fighter = FIGHTERS[id];
      expect(fighter.id).toBe(id);
      expect(fighter.name.length).toBeGreaterThan(2);
      expect(fighter.specialName.length).toBeGreaterThan(2);
      expect(fighter.description.length).toBeGreaterThan(20);
    }
  });

  it('gives every fighter a distinct health, walk speed and light reach profile', () => {
    const health = new Set(FIGHTER_ORDER.map((id) => FIGHTERS[id].maxHealth));
    const speed = new Set(FIGHTER_ORDER.map((id) => FIGHTERS[id].walkSpeed));
    const reach = new Set(FIGHTER_ORDER.map((id) => FIGHTERS[id].moves.light.reach));
    expect(health.size).toBe(4);
    expect(speed.size).toBe(4);
    expect(reach.size).toBe(4);
  });

  it('matches the intended archetypes', () => {
    expect(FIGHTERS.kestrel.walkSpeed).toBeGreaterThan(FIGHTERS.volt.walkSpeed);
    expect(FIGHTERS.volt.walkSpeed).toBeGreaterThan(FIGHTERS.mako.walkSpeed);
    expect(FIGHTERS.mako.maxHealth).toBeGreaterThan(FIGHTERS.volt.maxHealth);
    expect(FIGHTERS.kestrel.maxHealth).toBeLessThan(FIGHTERS.volt.maxHealth);
    expect(FIGHTERS.kestrel.moves.light.reach).toBeGreaterThan(FIGHTERS.mako.moves.light.reach);
    expect(FIGHTERS.sable.moves.special.damage).toBeGreaterThan(FIGHTERS.volt.moves.special.damage);
  });

  it('keeps every move positive, ordered and chip-limited', () => {
    for (const id of FIGHTER_ORDER) {
      const { moves } = FIGHTERS[id];
      for (const move of MOVES) {
        const spec = moves[move];
        expect(Number.isInteger(spec.startup)).toBe(true);
        expect(spec.startup).toBeGreaterThan(0);
        expect(Number.isInteger(spec.active)).toBe(true);
        expect(spec.active).toBeGreaterThan(0);
        expect(spec.recovery).toBeGreaterThan(0);
        expect(spec.damage).toBeGreaterThan(0);
        expect(spec.chip).toBeGreaterThan(0);
        expect(spec.chip).toBeLessThan(spec.damage);
        expect(spec.reach).toBeGreaterThan(0);
        expect(spec.hitstop).toBeGreaterThan(0);
        expect(spec.knockback).toBeGreaterThan(0);
        expect(Number.isInteger(spec.meterCost)).toBe(true);
        expect(Number.isInteger(spec.meterGainHit)).toBe(true);
        expect(Number.isInteger(spec.meterGainBlock)).toBe(true);
      }
      expect(moves.light.damage).toBeLessThan(moves.heavy.damage);
      expect(moves.heavy.damage).toBeLessThan(moves.special.damage);
      expect(moves.heavy.startup).toBeGreaterThan(moves.light.startup);
    }
  });

  it('charges meter only for specials', () => {
    for (const id of FIGHTER_ORDER) {
      const { moves } = FIGHTERS[id];
      expect(moves.light.meterCost).toBe(0);
      expect(moves.heavy.meterCost).toBe(0);
      expect(moves.special.meterCost).toBe(50);
    }
  });

  it('lets light attacks cancel into heavy for every fighter', () => {
    for (const id of FIGHTER_ORDER) {
      expect(FIGHTERS[id].moves.light.cancelInto).toContain('heavy');
    }
  });
});

describe('duel ladder', () => {
  it('runs five rungs and ends with Sable', () => {
    expect(DUEL_LADDER).toHaveLength(5);
    const last = DUEL_LADDER.at(-1)!;
    expect(last.fighter).toBe<FighterId>('sable');
    expect(last.tier).toBe('rival');
    expect(last.name.length).toBeGreaterThan(2);
  });

  it('uses only real fighters and known tiers, escalating in difficulty', () => {
    const tiers = DUEL_LADDER.map((rung) => rung.tier);
    for (const rung of DUEL_LADDER) {
      expect(FIGHTERS[rung.fighter]).toBeTruthy();
      expect(['rookie', 'standard', 'rival']).toContain(rung.tier);
    }
    expect(tiers[0]).toBe('rookie');
    expect(tiers.filter((tier) => tier === 'rival').length).toBeGreaterThan(0);
  });
});
