import { describe, expect, it } from 'vitest';
import { FIGHTERS } from './fighters';
import {
  MAX_METER,
  SPECIAL_COST,
  createFighterState,
  neutralInput,
  stepCombat,
  type CombatInput,
  type FighterState,
} from './combat';

const ARENA = { minX: -8, maxX: 8 };
const VOLT = FIGHTERS.volt;
const KESTREL = FIGHTERS.kestrel;
const LIGHT = VOLT.moves.light;

function input(patch: Partial<CombatInput>): CombatInput {
  return { ...neutralInput(), ...patch };
}

const EMPTY = neutralInput();

function place(distance: number): { a: FighterState; b: FighterState } {
  return {
    a: createFighterState(VOLT, 0, 1),
    b: createFighterState(KESTREL, distance, -1),
  };
}

function run(
  a: FighterState,
  b: FighterState,
  ticks: number,
  inputA: CombatInput = EMPTY,
  inputB: CombatInput = EMPTY,
) {
  let state = { a, b };
  let events: ReturnType<typeof stepCombat>['events'] = [];
  for (let index = 0; index < ticks; index += 1) {
    const result = stepCombat(state.a, state.b, inputA, inputB, ARENA);
    state = { a: result.a, b: result.b };
    events = events.concat(result.events);
  }
  return { ...state, events };
}

describe('combat basics', () => {
  it('produces no hit before startup and a hit during the active frames', () => {
    let { a, b } = place(LIGHT.reach);

    let result = stepCombat(a, b, input({ light: true }), EMPTY, ARENA);
    a = result.a;
    b = result.b;
    expect(result.events.some((event) => event.type === 'hit')).toBe(false);
    expect(a.action.kind).toBe('attack');

    const early = run(a, b, LIGHT.startup - 1);
    expect(early.events.some((event) => event.type === 'hit')).toBe(false);

    const active = run(early.a, early.b, 1);
    const hits = active.events.filter((event) => event.type === 'hit');
    expect(hits).toHaveLength(1);
    expect(active.b.health).toBe(KESTREL.maxHealth - LIGHT.damage);
  });

  it('reaches at its listed range and misses beyond it', () => {
    const halfWidth = KESTREL.hurtboxWidth / 2;
    const inRange = place(LIGHT.reach + halfWidth - 0.05);
    const hitRun = run(
      inRange.a,
      inRange.b,
      LIGHT.startup + LIGHT.active,
      input({ light: true }),
    );
    expect(hitRun.events.some((event) => event.type === 'hit')).toBe(true);

    const outOfRange = place(LIGHT.reach + halfWidth + 0.5);
    const missRun = run(
      outOfRange.a,
      outOfRange.b,
      LIGHT.startup + LIGHT.active,
      input({ light: true }),
    );
    expect(missRun.events.some((event) => event.type === 'hit')).toBe(false);
    expect(missRun.b.health).toBe(KESTREL.maxHealth);
  });

  it('lets simultaneous active attacks trade', () => {
    const a = createFighterState(VOLT, 0, 1);
    const b = createFighterState(VOLT, LIGHT.reach, -1);
    const result = run(a, b, LIGHT.startup + 1, input({ light: true }), input({ light: true }));

    const hits = result.events.filter((event) => event.type === 'hit');
    expect(hits).toHaveLength(2);
    expect(result.a.health).toBe(VOLT.maxHealth - LIGHT.damage);
    expect(result.b.health).toBe(VOLT.maxHealth - LIGHT.damage);
  });

  it('turns a blocked hit into chip damage and blockstun without hitstun', () => {
    const duel = place(LIGHT.reach);
    const result = run(
      duel.a,
      duel.b,
      LIGHT.startup + 1,
      input({ light: true }),
      input({ block: true }),
    );

    expect(result.events.some((event) => event.type === 'block')).toBe(true);
    expect(result.events.some((event) => event.type === 'hit')).toBe(false);
    expect(result.b.health).toBe(KESTREL.maxHealth - LIGHT.chip);
    expect(result.b.blockStun).toBeGreaterThan(0);
    expect(result.b.hitstun).toBe(0);
  });

  it('freezes both fighters while hitstop is active', () => {
    const duel = place(LIGHT.reach);
    const hit = run(duel.a, duel.b, LIGHT.startup + 1, input({ light: true }));
    expect(hit.a.hitstop).toBeGreaterThan(0);
    expect(hit.b.hitstop).toBeGreaterThan(0);
    expect(hit.a.action.kind).toBe('attack');

    const frame = hit.a.action.kind === 'attack' ? hit.a.action.frame : -1;
    const frozen = run(hit.a, hit.b, 1);
    const frozenFrame = frozen.a.action.kind === 'attack' ? frozen.a.action.frame : -1;

    expect(frozenFrame).toBe(frame);
    expect(frozen.a.hitstop).toBe(hit.a.hitstop - 1);
    expect(frozen.b.hitstop).toBe(hit.b.hitstop - 1);
  });

  it('gains meter on hit and caps it at the maximum', () => {
    const duel = place(LIGHT.reach);
    duel.a = { ...duel.a, meter: MAX_METER - 2 };
    const result = run(duel.a, duel.b, LIGHT.startup + 1, input({ light: true }));

    expect(result.events.some((event) => event.type === 'hit')).toBe(true);
    expect(result.a.meter).toBe(MAX_METER);
  });

  it('refuses a special below its meter cost and spends the cost when used', () => {
    const poor = place(LIGHT.reach);
    poor.a = { ...poor.a, meter: SPECIAL_COST - 10 };
    const refused = run(poor.a, poor.b, 2, input({ special: true }));
    expect(refused.a.action.kind).not.toBe('attack');
    expect(refused.a.meter).toBe(SPECIAL_COST - 10);
    expect(refused.events.some((event) => event.type === 'special')).toBe(false);

    const rich = place(3);
    rich.a = { ...rich.a, meter: SPECIAL_COST + 10 };
    const result = stepCombat(rich.a, rich.b, input({ special: true }), EMPTY, ARENA);
    expect(result.a.action.kind).toBe('attack');
    if (result.a.action.kind === 'attack') expect(result.a.action.move).toBe('special');
    expect(result.a.meter).toBe(10);
    expect(result.events.some((event) => event.type === 'special')).toBe(true);
  });

  it('lets a jump clear a grounded attack', () => {
    const duel = place(LIGHT.reach);
    const jumped = run(duel.a, duel.b, 8, EMPTY, input({ jump: true }));
    expect(jumped.b.y).toBeGreaterThan(0.9);

    const attack = run(jumped.a, jumped.b, LIGHT.startup + LIGHT.active, input({ light: true }), EMPTY);
    expect(attack.events.some((event) => event.type === 'hit' || event.type === 'block')).toBe(false);
    expect(attack.b.health).toBe(KESTREL.maxHealth);
  });

  it('cancels a landed light into heavy', () => {
    const duel = place(LIGHT.reach);
    const hit = run(duel.a, duel.b, LIGHT.startup + 1, input({ light: true }));
    expect(hit.events.some((event) => event.type === 'hit')).toBe(true);

    const cancelled = run(hit.a, hit.b, LIGHT.hitstop + 1, input({ heavy: true }));
    expect(cancelled.a.action.kind).toBe('attack');
    if (cancelled.a.action.kind === 'attack') {
      expect(cancelled.a.action.move).toBe('heavy');
    }
  });

  it('keeps both fighters inside the arena', () => {
    const arena = { minX: -3, maxX: 3 };
    let a = createFighterState(VOLT, 2.9, 1);
    let b = createFighterState(KESTREL, -2.9, -1);
    for (let index = 0; index < 60; index += 1) {
      const result = stepCombat(a, b, input({ right: true }), input({ left: true }), arena);
      a = result.a;
      b = result.b;
    }
    expect(a.x).toBeLessThanOrEqual(arena.maxX);
    expect(a.x).toBeGreaterThanOrEqual(arena.minX);
    expect(b.x).toBeGreaterThanOrEqual(arena.minX);
    expect(b.x).toBeLessThanOrEqual(arena.maxX);
  });

  it('emits exactly one ko event when health reaches zero', () => {
    const duel = place(LIGHT.reach);
    duel.a = { ...duel.a, meter: SPECIAL_COST };
    duel.b = { ...duel.b, health: VOLT.moves.special.damage - 20 };

    const finish = run(
      duel.a,
      duel.b,
      VOLT.moves.special.startup + 1,
      input({ special: true }),
    );

    expect(finish.b.health).toBe(0);
    expect(finish.events.filter((event) => event.type === 'ko')).toHaveLength(1);

    const after = run(finish.a, finish.b, 20);
    expect(after.events.filter((event) => event.type === 'ko')).toHaveLength(0);
  });
});
