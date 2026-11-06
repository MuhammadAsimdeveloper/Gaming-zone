import type { ContactInput, ShotDirection, ShotType } from './batting';
import type { BowlingLength, Delivery } from './delivery';

const NATURAL_DIRECTION: Record<Delivery['line'], ShotDirection> = {
  off: 'cover',
  middle: 'straight',
  leg: 'midwicket',
};

const DIRECTIONS: ReadonlyArray<ShotDirection> = ['fine', 'point', 'cover', 'straight', 'midwicket', 'leg'];

const SHOT_WEIGHTS: Record<BowlingLength, ReadonlyArray<[ShotType, number]>> = {
  short: [
    ['drive', 0.4],
    ['block', 0.15],
    ['loft', 0.45],
  ],
  good: [
    ['drive', 0.55],
    ['block', 0.25],
    ['loft', 0.2],
  ],
  full: [
    ['drive', 0.7],
    ['block', 0.1],
    ['loft', 0.2],
  ],
};

function pickShot(length: BowlingLength, roll: number): ShotType {
  let remaining = roll;
  for (const [shotType, weight] of SHOT_WEIGHTS[length]) {
    if (remaining < weight) return shotType;
    remaining -= weight;
  }
  return 'drive';
}

/**
 * The CPU batter reads the delivery and commits to a shot. Skill only sharpens
 * timing; it never guarantees contact.
 */
export function planCpuShot(delivery: Delivery, skill: number, rng: () => number): ContactInput {
  const clampedSkill = Math.min(1, Math.max(0, skill));
  const error = 0.16 - clampedSkill * 0.1;
  const timingOffset = (rng() * 2 - 1) * error;
  const shotType = pickShot(delivery.length, rng());
  const natural = NATURAL_DIRECTION[delivery.line];
  const stayNatural = rng() < 0.55 + clampedSkill * 0.25;
  const direction = stayNatural
    ? natural
    : DIRECTIONS[Math.min(DIRECTIONS.length - 1, Math.floor(rng() * DIRECTIONS.length))]!;
  return { timingOffset, direction, shotType, line: delivery.line, length: delivery.length };
}
