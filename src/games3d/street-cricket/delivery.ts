import type { TimingGrade } from './types';

export type BowlingLine = 'off' | 'middle' | 'leg';
export type BowlingLength = 'short' | 'good' | 'full';
export type BowlingVariation = 'stock' | 'pace' | 'spin';

export interface BowlingInput {
  line: BowlingLine;
  length: BowlingLength;
  variation: BowlingVariation;
}

export interface Delivery {
  line: BowlingLine;
  length: BowlingLength;
  variation: BowlingVariation;
  /** Lateral offset from middle stump at the crease, in metres. */
  lineX: number;
  /** Distance from the batter's stumps where the ball pitches, in metres. */
  bounceZ: number;
  seamAngle: number;
  /** Total lateral movement before the first bounce, in metres (capped). */
  swing: number;
  speedKph: number;
  /** Time from release to the batting crease, in seconds. */
  arrivalSeconds: number;
  label: string;
}

/** Release point down the pitch, measured from the batter's stumps. */
export const RELEASE_Z = 19;
const POST_BOUNCE_SPEED_FACTOR = 0.78;
const MAX_SWING = 0.35;
const GRADES: ReadonlyArray<[number, TimingGrade]> = [
  [0.035, 'perfect'],
  [0.09, 'good'],
  [0.17, 'ok'],
  [0.28, 'edge'],
];

const SPEED_KPH: Record<BowlingVariation, number> = {
  stock: 124,
  pace: 139,
  spin: 91,
};

const SWING_RANGE: Record<BowlingVariation, number> = {
  stock: 0.1,
  pace: 0.12,
  spin: 0.24,
};

export function lineOffset(line: BowlingLine): number {
  switch (line) {
    case 'off':
      return 0.18;
    case 'leg':
      return -0.18;
    default:
      return 0;
  }
}

export function bounceDistance(length: BowlingLength): number {
  switch (length) {
    case 'short':
      return 8.2;
    case 'full':
      return 2.6;
    default:
      return 4.8;
  }
}

export function createDelivery(input: BowlingInput, rng: () => number): Delivery {
  const speedKph = SPEED_KPH[input.variation];
  const speed = speedKph / 3.6;
  const bounceZ = bounceDistance(input.length);
  const airDistance = Math.max(0, RELEASE_Z - bounceZ);
  const arrivalSeconds = airDistance / speed + bounceZ / (speed * POST_BOUNCE_SPEED_FACTOR);
  const swingRoll = rng();
  const direction = swingRoll < 0.5 ? -1 : 1;
  const swing = Math.min(
    MAX_SWING,
    SWING_RANGE[input.variation] * (0.2 + Math.abs(swingRoll - 0.5) * 1.6) * direction,
  );
  const seamAngle = (rng() - 0.5) * Math.PI;
  return {
    ...input,
    lineX: lineOffset(input.line),
    bounceZ,
    seamAngle,
    swing,
    speedKph,
    arrivalSeconds,
    label: deliveryLabel(input),
  };
}

const LINE_TEXT: Record<BowlingLine, string> = {
  off: 'off stump',
  middle: 'middle',
  leg: 'leg stump',
};

const LENGTH_TEXT: Record<BowlingLength, string> = {
  short: 'short',
  good: 'good length',
  full: 'full',
};

const VARIATION_TEXT: Record<BowlingVariation, string> = {
  stock: 'stock ball',
  pace: 'pace',
  spin: 'spin',
};

export function deliveryLabel(input: BowlingInput): string {
  return `${LENGTH_TEXT[input.length]}, ${LINE_TEXT[input.line]}, ${VARIATION_TEXT[input.variation]}.`;
}

export function contactTimingGrade(offsetSeconds: number): TimingGrade {
  const magnitude = Math.abs(offsetSeconds);
  for (const [limit, grade] of GRADES) {
    if (magnitude <= limit) return grade;
  }
  return 'miss';
}
