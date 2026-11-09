/**
 * Neon Coast mission rules: pure state in, state out, no React or canvas.
 *
 * A mission runtime is advanced by the simulation with a snapshot of where the
 * player is and what they are doing. Events are emitted exactly once.
 */
import { seededRandom } from './random';
import {
  ROAD_HORIZONTAL,
  ROAD_VERTICAL,
  SOLARA_LANDMARKS,
  type Point,
} from './world';

export type MissionId =
  | 'tideglass-courier'
  | 'lantern-circuit'
  | 'landmark-trail'
  | 'glow-run';

export type MissionEvent =
  | { type: 'checkpoint'; id: string }
  | { type: 'discover'; id: string }
  | { type: 'shard'; index: number }
  | { type: 'complete' }
  | { type: 'failed' };

export interface MissionDefinition {
  id: MissionId;
  name: string;
  kind: 'delivery' | 'circuit' | 'exploration' | 'collect';
  brief: string;
  timeLimit: number;
  reward: number;
  unlocks: MissionId | null;
  repeatable: boolean;
}

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'tideglass-courier',
    name: 'Tideglass Courier',
    kind: 'delivery',
    brief: 'Collect the parcel at Tideglass Market and run it to Coral Radio Tower.',
    timeLimit: 100,
    reward: 450,
    unlocks: 'lantern-circuit',
    repeatable: false,
  },
  {
    id: 'lantern-circuit',
    name: 'Lantern Circuit',
    kind: 'circuit',
    brief: 'Drive the Vela through eight ordered lantern gates around the district.',
    timeLimit: 100,
    reward: 800,
    unlocks: 'landmark-trail',
    repeatable: false,
  },
  {
    id: 'landmark-trail',
    name: 'Landmark Trail',
    kind: 'exploration',
    brief: 'Find five of the district’s eight landmarks before the clock runs out.',
    timeLimit: 180,
    reward: 600,
    unlocks: 'glow-run',
    repeatable: false,
  },
  {
    id: 'glow-run',
    name: 'Glow Run',
    kind: 'collect',
    brief: 'Sweep eight seeded tide shards out of the streets before they fade.',
    timeLimit: 90,
    reward: 570,
    unlocks: null,
    repeatable: true,
  },
];

export interface MissionRuntime {
  id: MissionId;
  seed: number;
  status: 'active' | 'complete' | 'failed';
  elapsed: number;
  pickedUp: boolean;
  gateIndex: number;
  gates: Point[];
  discovered: string[];
  shards: Point[];
  collected: number[];
}

export interface MissionSnapshot {
  /** Seconds since the previous advance. */
  dt: number;
  position: Point;
  inVehicle: boolean;
  /** Landmark the player is standing at, if any. */
  landmarkId: string | null;
}

export interface MissionOutcome {
  completed: boolean;
  shards: number;
}

const COURIER_PICKUP_RADIUS = 100;
const COURIER_DROP_RADIUS = 100;
const CIRCUIT_GATE_RADIUS = 130;
const TRAIL_TARGET = 5;
const GLOW_SHARD_RADIUS = 70;
const GLOW_SHARD_COUNT = 8;
const GLOW_SHARD_REWARD = 40;
const GLOW_SWEEP_BONUS = 250;

/** Perimeters of the road grid, driven clockwise from the north-west. */
const CIRCUIT_GATES: Point[] = [
  { x: 260, y: 260 },
  { x: 1160, y: 260 },
  { x: 2060, y: 260 },
  { x: 2060, y: 1010 },
  { x: 2060, y: 1760 },
  { x: 1160, y: 1760 },
  { x: 260, y: 1760 },
  { x: 260, y: 1010 },
];

function shardPool(): Point[] {
  const pool: Point[] = [];
  for (const x of ROAD_VERTICAL) {
    for (const y of ROAD_HORIZONTAL) pool.push({ x, y });
  }
  for (let column = 0; column < ROAD_VERTICAL.length - 1; column += 1) {
    const x = (ROAD_VERTICAL[column]! + ROAD_VERTICAL[column + 1]!) / 2;
    for (const y of ROAD_HORIZONTAL) pool.push({ x, y });
  }
  return pool;
}

/** Fisher–Yates over a copy of the pool, then take the shard count. */
function placeShards(seed: number): Point[] {
  const pool = shardPool();
  const random = seededRandom(seed);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const held = pool[index]!;
    pool[index] = pool[swap]!;
    pool[swap] = held;
  }
  return pool.slice(0, GLOW_SHARD_COUNT);
}

function landmarkPosition(id: string): Point {
  const landmark = SOLARA_LANDMARKS.find((entry) => entry.id === id);
  if (!landmark) throw new Error(`Unknown landmark ${id}`);
  return { x: landmark.x, y: landmark.y };
}

function near(position: Point, target: Point, radius: number): boolean {
  return Math.hypot(position.x - target.x, position.y - target.y) <= radius;
}

export function beginMission(id: MissionId, seed: number): MissionRuntime {
  return {
    id,
    seed,
    status: 'active',
    elapsed: 0,
    pickedUp: false,
    gateIndex: 0,
    gates: id === 'lantern-circuit' ? CIRCUIT_GATES.map((gate) => ({ ...gate })) : [],
    discovered: [],
    shards: id === 'glow-run' ? placeShards(seed) : [],
    collected: [],
  };
}

export function advanceMission(
  runtime: MissionRuntime,
  snapshot: MissionSnapshot,
): { runtime: MissionRuntime; events: MissionEvent[] } {
  if (runtime.status !== 'active') return { runtime, events: [] };

  const events: MissionEvent[] = [];
  let next: MissionRuntime = {
    ...runtime,
    elapsed: runtime.elapsed + Math.max(0, snapshot.dt),
  };

  switch (runtime.id) {
    case 'tideglass-courier': {
      if (!next.pickedUp && near(snapshot.position, landmarkPosition('tideglass-market'), COURIER_PICKUP_RADIUS)) {
        next = { ...next, pickedUp: true };
        events.push({ type: 'checkpoint', id: 'courier-pickup' });
      }
      if (next.pickedUp && near(snapshot.position, landmarkPosition('coral-radio-tower'), COURIER_DROP_RADIUS)) {
        next = { ...next, status: 'complete' };
        events.push({ type: 'complete' });
      }
      break;
    }
    case 'lantern-circuit': {
      if (!snapshot.inVehicle) break;
      const gate = next.gates[next.gateIndex];
      if (gate && near(snapshot.position, gate, CIRCUIT_GATE_RADIUS)) {
        next = { ...next, gateIndex: next.gateIndex + 1 };
        events.push({ type: 'checkpoint', id: `gate-${next.gateIndex}` });
        if (next.gateIndex >= next.gates.length) {
          next = { ...next, status: 'complete' };
          events.push({ type: 'complete' });
        }
      }
      break;
    }
    case 'landmark-trail': {
      const discovered = snapshot.landmarkId;
      const known = SOLARA_LANDMARKS.some((entry) => entry.id === discovered);
      if (discovered && known && !next.discovered.includes(discovered)) {
        next = { ...next, discovered: [...next.discovered, discovered] };
        events.push({ type: 'discover', id: discovered });
        if (next.discovered.length >= TRAIL_TARGET) {
          next = { ...next, status: 'complete' };
          events.push({ type: 'complete' });
        }
      }
      break;
    }
    case 'glow-run': {
      for (let index = 0; index < next.shards.length; index += 1) {
        if (next.collected.includes(index)) continue;
        if (near(snapshot.position, next.shards[index]!, GLOW_SHARD_RADIUS)) {
          next = { ...next, collected: [...next.collected, index] };
          events.push({ type: 'shard', index });
        }
      }
      if (next.collected.length >= GLOW_SHARD_COUNT) {
        next = { ...next, status: 'complete' };
        events.push({ type: 'complete' });
      }
      break;
    }
  }

  if (next.status === 'active' && next.elapsed >= definitionFor(next.id).timeLimit) {
    next = { ...next, status: 'failed' };
    events.push({ type: 'failed' });
  }

  return { runtime: next, events };
}

export function definitionFor(id: MissionId): MissionDefinition {
  const definition = MISSIONS.find((mission) => mission.id === id);
  if (!definition) throw new Error(`Unknown mission ${id}`);
  return definition;
}

export function rewardFor(id: MissionId, outcome: MissionOutcome): number {
  if (id === 'glow-run') {
    const sweep = outcome.completed && outcome.shards >= GLOW_SHARD_COUNT ? GLOW_SWEEP_BONUS : 0;
    return outcome.shards * GLOW_SHARD_REWARD + sweep;
  }
  return outcome.completed ? definitionFor(id).reward : 0;
}

const RANKS = ['Newcomer', 'Local', 'Runner', 'Insider', 'Coast Legend'] as const;

export function rankFor(completed: readonly MissionId[]): string {
  const unique = new Set(completed.filter((id) => MISSIONS.some((mission) => mission.id === id)));
  return RANKS[Math.min(unique.size, RANKS.length - 1)]!;
}
