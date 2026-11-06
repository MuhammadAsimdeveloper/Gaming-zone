import { contactTimingGrade, type BowlingLength, type BowlingLine } from './delivery';
import type { TimingGrade } from './types';

export type ShotDirection = 'fine' | 'point' | 'cover' | 'straight' | 'midwicket' | 'leg';
export type ShotType = 'block' | 'drive' | 'loft';

export interface ContactInput {
  /** Seconds from the ideal instant; negative is early, positive is late. */
  timingOffset: number;
  direction: ShotDirection;
  shotType: ShotType;
  line: BowlingLine;
  length: BowlingLength;
}

export interface Contact {
  grade: TimingGrade;
  quality: number;
  direction: ShotDirection;
  /** Degrees above the ground. */
  launchAngle: number;
  power: number;
  edge: boolean;
  missed: boolean;
  note: string;
}

const ANGLES: Record<ShotDirection, number> = {
  fine: -70,
  point: -45,
  cover: -20,
  straight: 0,
  midwicket: 25,
  leg: 50,
};

const NATURAL_DIRECTION: Record<BowlingLine, ShotDirection> = {
  off: 'cover',
  middle: 'straight',
  leg: 'midwicket',
};

const EDGE_DIRECTION: Record<BowlingLine, ShotDirection> = {
  off: 'point',
  middle: 'fine',
  leg: 'fine',
};

const TIMING_FACTOR: Record<TimingGrade, number> = {
  perfect: 1,
  good: 0.78,
  ok: 0.5,
  edge: 0.22,
  miss: 0,
};

const SHOT_LENGTH_MATCH: Record<ShotType, Record<BowlingLength, number>> = {
  block: { short: 0.5, good: 1, full: 0.8 },
  drive: { short: 0.55, good: 0.85, full: 1 },
  loft: { short: 0.9, good: 0.75, full: 0.55 },
};

const BASE_POWER: Record<ShotType, number> = {
  block: 0.3,
  drive: 0.78,
  loft: 0.95,
};

const BASE_LOFT: Record<ShotType, number> = {
  block: 4,
  drive: 12,
  loft: 36,
};

export function directionAngle(direction: ShotDirection): number {
  return ANGLES[direction];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function resolveContact(input: ContactInput): Contact {
  const grade = contactTimingGrade(input.timingOffset);
  if (grade === 'miss') {
    return {
      grade,
      quality: 0,
      direction: input.direction,
      launchAngle: 0,
      power: 0,
      edge: false,
      missed: true,
      note: 'Beaten all ends up. The stumps are in danger.',
    };
  }

  const natural = NATURAL_DIRECTION[input.line];
  const gap = Math.abs(directionAngle(input.direction) - directionAngle(natural));
  const placement = clamp01(1 - Math.min(1, gap / 90) * 0.65);
  const shotMatch = SHOT_LENGTH_MATCH[input.shotType][input.length];
  const timing = TIMING_FACTOR[grade];
  const quality = clamp01(timing * (0.65 + 0.35 * placement) * (0.7 + 0.3 * shotMatch));

  if (grade === 'edge') {
    return {
      grade,
      quality,
      direction: EDGE_DIRECTION[input.line],
      launchAngle: 52,
      power: 0.35,
      edge: true,
      missed: false,
      note: 'Thick edge! It flies behind the wicket.',
    };
  }

  const power = clamp01(BASE_POWER[input.shotType] * timing * (0.75 + 0.25 * shotMatch));
  const launchAngle = BASE_LOFT[input.shotType] * (grade === 'ok' ? 1.15 : 1);
  const note =
    grade === 'perfect'
      ? `Timed sweetly through ${input.direction}.`
      : grade === 'good'
        ? 'Well timed into the gap.'
        : 'Mistimed, but it finds a gap.';

  return {
    grade,
    quality,
    direction: input.direction,
    launchAngle,
    power,
    edge: false,
    missed: false,
    note,
  };
}
