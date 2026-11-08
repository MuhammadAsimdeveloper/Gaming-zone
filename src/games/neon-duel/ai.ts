import type { AiTier, MoveId } from './fighters';
import { SPECIAL_COST, neutralInput, type CombatInput, type FighterState } from './combat';

export type { AiTier };

export interface AiProfile {
  reactionTicks: number;
  blockChance: number;
  aggression: number;
  spacing: number;
  specialUse: number;
  moveChance: number;
}

export const AI_PROFILES: Record<AiTier, AiProfile> = {
  rookie: {
    reactionTicks: 24,
    blockChance: 0.2,
    aggression: 0.35,
    spacing: 1.3,
    specialUse: 0.15,
    moveChance: 0.55,
  },
  standard: {
    reactionTicks: 12,
    blockChance: 0.55,
    aggression: 0.55,
    spacing: 1.45,
    specialUse: 0.35,
    moveChance: 0.8,
  },
  rival: {
    reactionTicks: 6,
    blockChance: 0.8,
    aggression: 0.72,
    spacing: 1.55,
    specialUse: 0.55,
    moveChance: 0.95,
  },
};

export interface AiMemory {
  queue: boolean[];
  decideAt: number;
  held: CombatInput;
}

export function createAiMemory(): AiMemory {
  return { queue: [], decideAt: 0, held: neutralInput() };
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function decide(
  self: FighterState,
  opponent: FighterState,
  profile: AiProfile,
  rng: () => number,
): { held: CombatInput; attack: MoveId | null } {
  const distance = Math.abs(opponent.x - self.x);
  const telegraph = opponent.action.kind === 'attack' && !opponent.action.hasHit;

  if (telegraph && distance <= profile.spacing * 1.6 && rng() < profile.blockChance) {
    const held = neutralInput();
    held.block = true;
    return { held, attack: null };
  }

  if (distance > profile.spacing) {
    const held = neutralInput();
    if (opponent.x >= self.x) held.right = true;
    else held.left = true;
    return { held, attack: null };
  }

  if (rng() >= profile.moveChance) {
    const held = neutralInput();
    held.block = rng() < profile.blockChance;
    return { held, attack: null };
  }

  const base: MoveId = rng() < profile.aggression ? 'heavy' : 'light';
  const attack: MoveId =
    self.meter >= SPECIAL_COST && rng() < profile.specialUse ? 'special' : base;

  const held = neutralInput();
  held[attack] = true;
  return { held, attack };
}

export function chooseAiInput(
  memory: AiMemory,
  self: FighterState,
  opponent: FighterState,
  profile: AiProfile,
  tick: number,
  rng: () => number,
): { input: CombatInput; memory: AiMemory } {
  let next = memory;
  if (tick >= memory.decideAt) {
    const decision = decide(self, opponent, profile, rng);
    next = {
      queue: decision.attack ? [true] : [],
      decideAt: tick + profile.reactionTicks,
      held: decision.held,
    };
  }

  const [press = false, ...rest] = next.queue;
  const input: CombatInput = {
    ...next.held,
    light: press && next.held.light,
    heavy: press && next.held.heavy,
    special: press && next.held.special,
  };

  return { input, memory: { ...next, queue: rest } };
}
