import { describe, expect, it } from 'vitest';
import { FIGHTERS } from './fighters';
import { createFighterState, type CombatInput, type FighterState } from './combat';
import {
  AI_PROFILES,
  chooseAiInput,
  createAiMemory,
  mulberry32,
  type AiProfile,
} from './ai';

function self(meter = 0): FighterState {
  return { ...createFighterState(FIGHTERS.volt, 0, 1), meter };
}

function idleOpponent(x: number): FighterState {
  return createFighterState(FIGHTERS.kestrel, x, -1);
}

function attackingOpponent(x: number): FighterState {
  return {
    ...createFighterState(FIGHTERS.kestrel, x, -1),
    action: { kind: 'attack', move: 'light', frame: 0, hasHit: false },
  };
}

function attacks(input: CombatInput): boolean {
  return input.light || input.heavy || input.special;
}

describe('ai profiles', () => {
  it('defines all three tiers with faster reactions as they get harder', () => {
    expect(Object.keys(AI_PROFILES).sort()).toEqual(['rival', 'rookie', 'standard']);
    expect(AI_PROFILES.rookie.reactionTicks).toBeGreaterThan(AI_PROFILES.standard.reactionTicks);
    expect(AI_PROFILES.standard.reactionTicks).toBeGreaterThan(AI_PROFILES.rival.reactionTicks);
    expect(AI_PROFILES.rival.blockChance).toBeGreaterThan(AI_PROFILES.rookie.blockChance);
  });
});

describe('seeded ai decisions', () => {
  it('is deterministic for the same seed and state', () => {
    const run = () => {
      const rng = mulberry32(1234);
      let memory = createAiMemory();
      let fighter = self(40);
      const opponent = idleOpponent(2);
      const inputs: CombatInput[] = [];
      for (let tick = 0; tick < 180; tick += 1) {
        const result = chooseAiInput(memory, fighter, opponent, AI_PROFILES.standard, tick, rng);
        inputs.push(result.input);
        memory = result.memory;
        fighter = { ...fighter, x: fighter.x + 0.01 };
      }
      return inputs;
    };

    expect(run()).toEqual(run());
  });

  it('approaches when out of spacing', () => {
    const profile: AiProfile = {
      ...AI_PROFILES.standard,
      reactionTicks: 1,
      moveChance: 1,
      aggression: 1,
      specialUse: 0,
      blockChance: 0,
    };
    const result = chooseAiInput(
      createAiMemory(),
      self(),
      idleOpponent(6),
      profile,
      0,
      mulberry32(7),
    );
    expect(result.input.right).toBe(true);
    expect(result.input.left).toBe(false);
    expect(attacks(result.input)).toBe(false);
  });

  it('attacks when inside spacing', () => {
    const profile: AiProfile = {
      ...AI_PROFILES.standard,
      reactionTicks: 1,
      moveChance: 1,
      aggression: 1,
      specialUse: 0,
      blockChance: 0,
    };
    const result = chooseAiInput(
      createAiMemory(),
      self(),
      idleOpponent(1),
      profile,
      0,
      mulberry32(7),
    );
    expect(result.input.heavy).toBe(true);
  });

  it('blocks a telegraphed attack when block chance is certain', () => {
    const profile: AiProfile = {
      ...AI_PROFILES.standard,
      reactionTicks: 10,
      blockChance: 1,
      moveChance: 0,
    };
    const result = chooseAiInput(
      createAiMemory(),
      self(),
      attackingOpponent(1.2),
      profile,
      0,
      mulberry32(3),
    );
    expect(result.input.block).toBe(true);
    expect(attacks(result.input)).toBe(false);
  });

  it('spends meter on a special only when it can afford one', () => {
    const profile: AiProfile = {
      ...AI_PROFILES.standard,
      reactionTicks: 1,
      moveChance: 1,
      aggression: 0,
      specialUse: 1,
      blockChance: 0,
    };
    const rng = () => 0.5;

    const poor = chooseAiInput(createAiMemory(), self(20), idleOpponent(1), profile, 0, rng);
    expect(poor.input.special).toBe(false);
    expect(poor.input.light).toBe(true);

    const rich = chooseAiInput(createAiMemory(), self(60), idleOpponent(1), profile, 0, rng);
    expect(rich.input.special).toBe(true);
  });

  it('holds its decision until the reaction delay expires', () => {
    const profile: AiProfile = {
      ...AI_PROFILES.standard,
      reactionTicks: 5,
      moveChance: 0,
    };
    const first = chooseAiInput(
      createAiMemory(),
      self(),
      idleOpponent(6),
      profile,
      0,
      mulberry32(2),
    );
    expect(first.memory.decideAt).toBe(5);
    expect(first.input.right).toBe(true);

    const held = chooseAiInput(first.memory, self(), idleOpponent(6), profile, 3, mulberry32(99));
    expect(held.memory.decideAt).toBe(5);
    expect(held.input.right).toBe(true);

    const redecided = chooseAiInput(held.memory, self(), idleOpponent(6), profile, 5, mulberry32(99));
    expect(redecided.memory.decideAt).toBe(10);
  });
});
