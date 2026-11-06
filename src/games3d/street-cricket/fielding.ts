import { directionAngle, type Contact } from './batting';
import type { BallOutcome } from './types';

export interface Fielder {
  id: string;
  name: string;
  /** Degrees from straight down the ground; off side negative, leg side positive. */
  angle: number;
  distance: number;
}

export const FIELDERS: ReadonlyArray<Fielder> = [
  { id: 'keeper', name: 'Keeper', angle: 180, distance: 5 },
  { id: 'slip', name: 'Slip', angle: -150, distance: 9 },
  { id: 'point', name: 'Point', angle: -100, distance: 15 },
  { id: 'cover', name: 'Cover', angle: -55, distance: 19 },
  { id: 'mid-off', name: 'Mid-off', angle: -18, distance: 16 },
  { id: 'mid-on', name: 'Mid-on', angle: 18, distance: 16 },
  { id: 'midwicket', name: 'Midwicket', angle: 55, distance: 19 },
  { id: 'square-leg', name: 'Square leg', angle: 100, distance: 15 },
  { id: 'deep-mid', name: 'Deep mid', angle: 0, distance: 30 },
];

export const BOUNDARY_RADIUS = 34;
const GRAVITY = 9.81;
const CATCH_RADIUS = 4;
const LOFT_RISK_ANGLE = 15;

export interface ShotOptions {
  fielders: boolean;
  boundaryRadius?: number;
}

export interface ShotResult extends BallOutcome {
  fielder: string | null;
  distance: number;
  carry: number;
}

function radi(ans: number): number {
  return (ans * Math.PI) / 180;
}

function separation(aAngle: number, aDistance: number, bAngle: number, bDistance: number): number {
  const delta = radi(aAngle - bAngle);
  const squared = aDistance ** 2 + bDistance ** 2 - 2 * aDistance * bDistance * Math.cos(delta);
  return Math.sqrt(Math.max(0, squared));
}

function nearestFielder(angle: number, distance: number): { fielder: Fielder; gap: number } | null {
  let best: { fielder: Fielder; gap: number } | null = null;
  for (const fielder of FIELDERS) {
    const gap = separation(angle, distance, fielder.angle, fielder.distance);
    if (!best || gap < best.gap) best = { fielder, gap };
  }
  return best;
}

function runsForDistance(distance: number): number {
  if (distance < 7) return 0;
  if (distance < 14) return 1;
  if (distance < 24) return 2;
  return 3;
}

function buildResult(contact: Contact, result: Omit<ShotResult, 'timing'>): ShotResult {
  return { ...result, timing: contact.grade };
}

export function resolveShot(
  contact: Contact,
  options: ShotOptions,
  rng: () => number = Math.random,
): ShotResult {
  const boundary = options.boundaryRadius ?? BOUNDARY_RADIUS;

  if (contact.missed) {
    return buildResult(contact, {
      batRuns: 0,
      extras: 0,
      legal: true,
      wicket: 'bowled',
      boundary: null,
      note: 'Through the gate — bowled!',
      fielder: null,
      distance: 0,
      carry: 0,
    });
  }

  const velocity = 12 + contact.power * 14;
  const angleRadians = radi(contact.launchAngle);
  const carry = (velocity ** 2 * Math.sin(2 * angleRadians)) / GRAVITY;
  const roll =
    contact.launchAngle < LOFT_RISK_ANGLE ? velocity * (0.3 + contact.power * 0.45) : velocity * 0.15;
  const distance = carry + roll;
  const near = nearestFielder(directionAngle(contact.direction), Math.min(distance, boundary));

  if (contact.edge) {
    const catchChance = 0.35 + (1 - contact.quality) * 0.5;
    if (options.fielders && rng() < catchChance) {
      return buildResult(contact, {
        batRuns: 0,
        extras: 0,
        legal: true,
        wicket: 'caught',
        boundary: null,
        note: 'Feathered behind, and the keeper takes it.',
        fielder: 'Keeper',
        distance,
        carry,
      });
    }
    return buildResult(contact, {
      batRuns: 1,
      extras: 0,
      legal: true,
      wicket: null,
      boundary: null,
      note: 'Off the edge and away for a single.',
      fielder: near?.fielder.name ?? null,
      distance,
      carry,
    });
  }

  if (contact.launchAngle >= LOFT_RISK_ANGLE && carry >= boundary) {
    return buildResult(contact, {
      batRuns: 6,
      extras: 0,
      legal: true,
      wicket: null,
      boundary: 6,
      note: "That's gone over the rope — six!",
      fielder: null,
      distance,
      carry,
    });
  }

  if (distance >= boundary && contact.launchAngle < LOFT_RISK_ANGLE) {
    return buildResult(contact, {
      batRuns: 4,
      extras: 0,
      legal: true,
      wicket: null,
      boundary: 4,
      note: 'Beats the rope on the ground — four.',
      fielder: null,
      distance,
      carry,
    });
  }

  if (options.fielders && contact.launchAngle >= LOFT_RISK_ANGLE && carry >= 6 && near && near.gap <= CATCH_RADIUS) {
    if (rng() < 0.8) {
      return buildResult(contact, {
        batRuns: 0,
        extras: 0,
        legal: true,
        wicket: 'caught',
        boundary: null,
        note: `Skied, and ${near.fielder.name} settles under it.`,
        fielder: near.fielder.name,
        distance,
        carry,
      });
    }
  }

  if (distance >= boundary) {
    return buildResult(contact, {
      batRuns: 4,
      extras: 0,
      legal: true,
      wicket: null,
      boundary: 4,
      note: 'Beats the rope on the ground — four.',
      fielder: null,
      distance,
      carry,
    });
  }

  const runs = runsForDistance(distance);
  return buildResult(contact, {
    batRuns: runs,
    extras: 0,
    legal: true,
    wicket: null,
    boundary: null,
    note:
      runs === 0
        ? 'Fielded inside the ring. No run.'
        : `Worked into the gap for ${runs === 1 ? 'a single' : `${runs} runs`}.`,
    fielder: near?.fielder.name ?? null,
    distance,
    carry,
  });
}
