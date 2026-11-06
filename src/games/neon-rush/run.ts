import {
  createTrack,
  ensureAhead,
  type Track,
  type WorldObstacle,
  type WorldPowerUp,
  type WorldShard,
} from './chunks';
import {
  PLAYER_DEPTH,
  applyPlayerAction,
  createPlayer,
  stepPlayer,
  type PlayerAction,
  type PlayerState,
} from './player';

export type RunMode = 'endless' | 'time-attack';
export type RunEvent = 'shard' | 'powerup' | 'shield-break' | 'crash' | 'end';
export type RunEndReason = 'drone' | 'time';

export const START_SPEED = 12;
export const MAX_SPEED = 28;
export const SPEED_RAMP_SECONDS = 150;
export const TIME_ATTACK_SECONDS = 120;
export const CRASH_TIME_PENALTY = 2;
export const COMBO_WINDOW = 4;
export const SHIELD_INVULNERABILITY = 0.8;
export const CRASH_INVULNERABILITY = 1.4;
export const STUMBLE_SECONDS = 1;
export const OVERDRIVE_SECONDS = 6;
export const MAGNET_SECONDS = 8;
export const BARRIER_CLEAR_HEIGHT = 0.55;
export const MAX_STEP = 0.05;

const NO_EVENTS: RunEvent[] = [];

export interface RunState {
  mode: RunMode;
  seed: number;
  track: Track;
  distance: number;
  elapsed: number;
  speed: number;
  shards: number;
  combo: number;
  comboTimer: number;
  crashes: number;
  score: number;
  ended: boolean;
  endReason: RunEndReason | null;
  timeLeft: number;
  shield: boolean;
  magnetTimer: number;
  overdriveTimer: number;
  invulnerable: number;
  stumbleTimer: number;
  player: PlayerState;
}

export function speedAt(elapsed: number, overdrive = false): number {
  const ramp = Math.min(1, Math.max(0, elapsed) / SPEED_RAMP_SECONDS);
  const base = Math.min(MAX_SPEED, START_SPEED + (MAX_SPEED - START_SPEED) * ramp);
  return overdrive ? base * 1.35 : base;
}

export function multiplierFor(combo: number): number {
  return 1 + Math.min(20, Math.max(0, combo)) * 0.25;
}

export function scoreFor(distance: number, shards: number, combo: number): number {
  return Math.floor(distance) + shards * 10 * multiplierFor(combo);
}

export function dronePressure(run: RunState): number {
  const crashPressure = Math.min(0.85, run.crashes * 0.45);
  const timePressure = Math.min(0.3, run.elapsed / 600);
  return Math.min(1, crashPressure + timePressure);
}

export function createRun(mode: RunMode, seed: number, track?: Track): RunState {
  const activeTrack = track ?? createTrack(seed);
  const run: RunState = {
    mode,
    seed,
    track: activeTrack,
    distance: 0,
    elapsed: 0,
    speed: START_SPEED,
    shards: 0,
    combo: 0,
    comboTimer: 0,
    crashes: 0,
    score: 0,
    ended: false,
    endReason: null,
    timeLeft: mode === 'time-attack' ? TIME_ATTACK_SECONDS : 0,
    shield: false,
    magnetTimer: 0,
    overdriveTimer: 0,
    invulnerable: 0,
    stumbleTimer: 0,
    player: createPlayer(),
  };
  ensureAhead(activeTrack, 0);
  return run;
}

export function applyRunAction(run: RunState, action: PlayerAction): boolean {
  if (run.ended) return false;
  return applyPlayerAction(run.player, action);
}

function endRun(run: RunState, reason: RunEndReason, events: RunEvent[]): void {
  if (run.ended) return;
  run.ended = true;
  run.endReason = reason;
  events.push('end');
}

function clearsObstacle(run: RunState, obstacle: WorldObstacle): boolean {
  if (obstacle.kind === 'train') return false;
  if (obstacle.kind === 'barrier') return run.player.y >= BARRIER_CLEAR_HEIGHT;
  return run.player.rolling;
}

function hitObstacle(run: RunState, obstacle: WorldObstacle, events: RunEvent[]): void {
  if (obstacle.hit) return;
  obstacle.hit = true;

  if (run.invulnerable > 0 || run.overdriveTimer > 0) return;

  if (run.shield) {
    run.shield = false;
    run.invulnerable = SHIELD_INVULNERABILITY;
    run.combo = 0;
    run.comboTimer = 0;
    events.push('shield-break');
    return;
  }

  run.crashes += 1;
  run.combo = 0;
  run.comboTimer = 0;
  run.stumbleTimer = STUMBLE_SECONDS;
  run.invulnerable = CRASH_INVULNERABILITY;
  events.push('crash');

  if (run.mode === 'time-attack') {
    run.timeLeft = Math.max(0, run.timeLeft - CRASH_TIME_PENALTY);
    if (run.timeLeft === 0) endRun(run, 'time', events);
    return;
  }

  if (run.crashes >= 2) endRun(run, 'drone', events);
}

function collectPickups(run: RunState, previous: number, events: RunEvent[]): void {
  const magnet = run.magnetTimer > 0;
  const reach = run.distance + (magnet ? 8 : 4.5);
  const laneDistance = (lane: WorldShard['lane'] | WorldPowerUp['lane']): number =>
    Math.abs(lane - run.player.lane);

  for (const shard of run.track.shards) {
    if (shard.collected) continue;
    if (shard.z < previous - 1 || shard.z > reach) continue;
    if (laneDistance(shard.lane) > (magnet ? 1 : 0)) continue;
    shard.collected = true;
    run.shards += 1;
    run.combo += 1;
    run.comboTimer = COMBO_WINDOW;
    events.push('shard');
  }

  for (const powerUp of run.track.powerups) {
    if (powerUp.collected) continue;
    if (powerUp.z < previous - 1 || powerUp.z > run.distance + 2) continue;
    if (powerUp.lane !== run.player.lane) continue;
    powerUp.collected = true;
    if (powerUp.kind === 'shield') run.shield = true;
    else if (powerUp.kind === 'magnet') run.magnetTimer = MAGNET_SECONDS;
    else run.overdriveTimer = OVERDRIVE_SECONDS;
    events.push('powerup');
  }
}

export function stepRun(run: RunState, delta: number): RunEvent[] {
  if (run.ended) return NO_EVENTS;
  const step = Math.min(MAX_STEP, Math.max(0, delta));
  if (step === 0) return NO_EVENTS;

  const events: RunEvent[] = [];

  run.elapsed += step;
  if (run.mode === 'time-attack') {
    run.timeLeft = Math.max(0, run.timeLeft - step);
    if (run.timeLeft === 0) {
      endRun(run, 'time', events);
      return events;
    }
  }

  run.invulnerable = Math.max(0, run.invulnerable - step);
  run.stumbleTimer = Math.max(0, run.stumbleTimer - step);
  run.magnetTimer = Math.max(0, run.magnetTimer - step);
  run.overdriveTimer = Math.max(0, run.overdriveTimer - step);

  if (run.comboTimer > 0) {
    run.comboTimer = Math.max(0, run.comboTimer - step);
    if (run.comboTimer === 0) run.combo = 0;
  }

  stepPlayer(run.player, step);

  run.speed = speedAt(run.elapsed, run.overdriveTimer > 0);
  if (run.stumbleTimer > 0) run.speed *= 0.55;

  const previous = run.distance;
  run.distance += run.speed * step;
  const front = run.distance + PLAYER_DEPTH;

  ensureAhead(run.track, run.distance);

  for (const obstacle of run.track.obstacles) {
    if (obstacle.hit) continue;
    if (obstacle.z + obstacle.length < previous) continue;
    if (obstacle.z > front) continue;
    if (obstacle.lane !== run.player.lane) continue;
    if (clearsObstacle(run, obstacle)) {
      obstacle.hit = true;
      continue;
    }
    hitObstacle(run, obstacle, events);
  }

  collectPickups(run, previous, events);
  run.score = scoreFor(run.distance, run.shards, run.combo);

  return events;
}
