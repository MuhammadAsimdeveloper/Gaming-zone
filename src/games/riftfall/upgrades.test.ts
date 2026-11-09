import { describe, expect, it } from 'vitest';
import { WEAPON_IDS, createRun, type RunState } from './simulation';
import { UPGRADES, WEAPONS, applyUpgrade, rollOffers } from './upgrades';

function makeRun(seed = 5): RunState {
  return createRun({ seed, weapon: 'blade' });
}

describe('riftfall weapons and upgrades', () => {
  it('gives every weapon a distinct damage, cooldown and range', () => {
    const damages = new Set(WEAPON_IDS.map((id) => WEAPONS[id].damage));
    const cooldowns = new Set(WEAPON_IDS.map((id) => WEAPONS[id].cooldownTicks));
    const ranges = new Set(WEAPON_IDS.map((id) => WEAPONS[id].range));
    expect(damages.size).toBe(WEAPON_IDS.length);
    expect(cooldowns.size).toBe(WEAPON_IDS.length);
    expect(ranges.size).toBe(WEAPON_IDS.length);
  });

  it('offers three unique upgrades from the pool', () => {
    const offers = rollOffers(makeRun(9));
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((upgrade) => upgrade.id)).size).toBe(3);
    for (const offer of offers) expect(UPGRADES).toContain(offer);
  });

  it('produces identical offers for identical seeds', () => {
    const first = rollOffers(makeRun(31)).map((upgrade) => upgrade.id);
    const second = rollOffers(makeRun(31)).map((upgrade) => upgrade.id);
    expect(first).toEqual(second);
  });

  it('never offers a maxed upgrade', () => {
    const state = makeRun(9);
    const maxed = UPGRADES.find((upgrade) => upgrade.id === 'overcharge');
    expect(maxed).toBeDefined();
    for (let stack = 0; stack < (maxed?.maxStacks ?? 0); stack += 1) {
      expect(applyUpgrade(state, 'overcharge')).toBe(true);
    }
    expect(applyUpgrade(state, 'overcharge')).toBe(false);
    for (let roll = 0; roll < 40; roll += 1) {
      expect(rollOffers(state).map((upgrade) => upgrade.id)).not.toContain('overcharge');
    }
  });

  it('raises the weapon stat it names', () => {
    const state = makeRun();
    const before = { ...state.weapons.blade };
    expect(applyUpgrade(state, 'edge-oil')).toBe(true);
    expect(state.weapons.blade.damage).toBe(before.damage + 6);
    expect(applyUpgrade(state, 'quick-hands')).toBe(true);
    expect(state.weapons.blade.cooldownTicks).toBeLessThan(before.cooldownTicks);
    expect(applyUpgrade(state, 'long-reach')).toBe(true);
    expect(state.weapons.blade.range).toBeGreaterThan(before.range);
    expect(applyUpgrade(state, 'split-shot')).toBe(true);
    expect(state.weapons.blade.area).toBeGreaterThan(before.area);
    expect(state.weapons.rail.damage).toBe(WEAPONS.rail.damage + 6);
  });

  it('compounds stacked damage upgrades', () => {
    const state = makeRun();
    const base = state.weapons.blade.damage;
    expect(applyUpgrade(state, 'edge-oil')).toBe(true);
    expect(applyUpgrade(state, 'edge-oil')).toBe(true);
    expect(state.weapons.blade.damage).toBe(base + 12);
    expect(state.upgrades['edge-oil']).toBe(2);
  });

  it('rejects an unknown upgrade without changing anything', () => {
    const state = makeRun();
    const snapshot = { ...state.weapons.blade };
    expect(applyUpgrade(state, 'not-a-real-upgrade')).toBe(false);
    expect(state.weapons.blade).toEqual(snapshot);
    expect(state.upgrades).toEqual({});
  });

  it('applies the global upgrades to run state', () => {
    const state = makeRun();
    expect(applyUpgrade(state, 'kinetic-boots')).toBe(true);
    expect(state.dashCooldownLength).toBe(30);
    expect(applyUpgrade(state, 'rift-heart')).toBe(true);
    expect(state.player.maxHealth).toBe(120);
    expect(state.player.health).toBe(120);
    expect(applyUpgrade(state, 'combo-core')).toBe(true);
    expect(state.comboDecayTicks).toBe(240);
    expect(applyUpgrade(state, 'parry-focus')).toBe(true);
    expect(state.parryWindow).toBe(14);
    expect(applyUpgrade(state, 'overcharge')).toBe(true);
    expect(state.scoreBonus).toBeCloseTo(0.25);
  });

  it('caps every upgrade at its own max stacks', () => {
    const state = makeRun();
    for (const upgrade of UPGRADES) {
      for (let stack = 0; stack < upgrade.maxStacks; stack += 1) {
        expect(applyUpgrade(state, upgrade.id), upgrade.id).toBe(true);
      }
      expect(applyUpgrade(state, upgrade.id), upgrade.id).toBe(false);
      expect(state.upgrades[upgrade.id]).toBe(upgrade.maxStacks);
    }
    expect(rollOffers(state)).toEqual([]);
  });
});
