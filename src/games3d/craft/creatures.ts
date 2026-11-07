import { ITEM } from './items';
import type { Vec3 } from './player';

export type CreatureKind = 'gloomling' | 'cinder-wisp';
export type CreatureMood = 'wander' | 'chase' | 'windup' | 'flee' | 'hover';
export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn';

export interface CreatureStats {
  health: number;
  speed: number;
  sight: number;
  attackRange: number;
  windup: number;
  attackCooldown: number;
  damage: number;
}

export const CREATURE_STATS: Record<CreatureKind, CreatureStats> = {
  gloomling: {
    health: 12,
    speed: 2.6,
    sight: 12,
    attackRange: 1.6,
    windup: 0.9,
    attackCooldown: 0.9,
    damage: 4,
  },
  'cinder-wisp': {
    health: 8,
    speed: 1.8,
    sight: 14,
    attackRange: 8,
    windup: 0,
    attackCooldown: 2.5,
    damage: 3,
  },
};

export const MAX_HOSTILES = 12;
export const DESPAWN_DISTANCE = 64;
export const WISP_MIN_RANGE = 5;
export const WISP_MAX_RANGE = 8;

export interface CreatureWorld {
  isSolid(x: number, y: number, z: number): boolean;
}

export interface CreatureState {
  kind: CreatureKind;
  position: Vec3;
  health: number;
  mood: CreatureMood;
  timer: number;
  attackTimer: number;
  wanderTimer: number;
  wanderAngle: number;
}

export type CreatureEvent =
  | { type: 'melee' | 'ember'; damage: number }
  | { type: 'despawn' };

export interface CreatureContext {
  player: { position: Vec3; health: number };
  phase: DayPhase;
  emberBias: number;
  random: () => number;
}

export interface SpawnContext {
  light: number;
  phase: DayPhase;
  distanceToPlayer: number;
  onSolidGround: boolean;
  underground: boolean;
  emberBias: number;
  hostileCount: number;
  random: () => number;
}

export function createCreature(kind: CreatureKind, position: Vec3): CreatureState {
  return {
    kind,
    position: { ...position },
    health: CREATURE_STATS[kind].health,
    mood: kind === 'gloomling' ? 'wander' : 'hover',
    timer: 0,
    attackTimer: 0,
    wanderTimer: 0,
    wanderAngle: 0,
  };
}

export function damageCreature(state: CreatureState, amount: number): boolean {
  state.health = Math.max(0, state.health - Math.max(0, amount));
  return state.health === 0;
}

export function stepCreature(
  state: CreatureState,
  world: CreatureWorld | null,
  ctx: CreatureContext,
  dt: number,
  events: CreatureEvent[],
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const stats = CREATURE_STATS[state.kind];
  const dx = ctx.player.position.x - state.position.x;
  const dz = ctx.player.position.z - state.position.z;
  const distance = Math.hypot(dx, dz);

  if (distance > DESPAWN_DISTANCE || ctx.phase === 'dawn') {
    events.push({ type: 'despawn' });
    return;
  }

  if (state.kind === 'gloomling') {
    stepGloomling(state, world, ctx, dt, events, dx, dz, distance, stats);
  } else {
    stepWisp(state, world, dt, events, dx, dz, distance, stats);
  }
}

function stepGloomling(
  state: CreatureState,
  world: CreatureWorld | null,
  ctx: CreatureContext,
  dt: number,
  events: CreatureEvent[],
  dx: number,
  dz: number,
  distance: number,
  stats: CreatureStats,
): void {
  if (ctx.phase === 'day') {
    state.mood = 'flee';
    state.timer += dt;
    move(state, world, -dx, -dz, stats.speed, dt);
    return;
  }

  if (distance <= stats.attackRange) {
    if (state.mood !== 'windup') {
      state.mood = 'windup';
      state.timer = 0;
    }
    state.timer += dt;
    if (state.timer >= stats.windup) {
      events.push({ type: 'melee', damage: stats.damage });
      state.timer = 0;
      state.mood = 'chase';
    }
    return;
  }

  if (distance <= stats.sight) {
    state.mood = 'chase';
    state.timer += dt;
    move(state, world, dx, dz, stats.speed, dt);
    return;
  }

  state.mood = 'wander';
  state.wanderTimer -= dt;
  if (state.wanderTimer <= 0) {
    state.wanderAngle = ctx.random() * Math.PI * 2;
    state.wanderTimer = 2 + ctx.random() * 2;
  }
  move(state, world, Math.cos(state.wanderAngle), Math.sin(state.wanderAngle), stats.speed * 0.5, dt);
}

function stepWisp(
  state: CreatureState,
  world: CreatureWorld | null,
  dt: number,
  events: CreatureEvent[],
  dx: number,
  dz: number,
  distance: number,
  stats: CreatureStats,
): void {
  state.mood = 'hover';
  state.attackTimer += dt;

  if (distance < WISP_MIN_RANGE) {
    move(state, world, -dx, -dz, stats.speed, dt);
  } else if (distance > WISP_MAX_RANGE) {
    move(state, world, dx, dz, stats.speed, dt);
  }

  if (distance <= stats.sight && state.attackTimer >= stats.attackCooldown) {
    events.push({ type: 'ember', damage: stats.damage });
    state.attackTimer = 0;
  }
}

function move(
  state: CreatureState,
  world: CreatureWorld | null,
  dx: number,
  dz: number,
  speed: number,
  dt: number,
): void {
  const length = Math.hypot(dx, dz);
  if (length < 1e-9) return;
  moveAxis(state, world, 'x', (dx / length) * speed * dt);
  moveAxis(state, world, 'z', (dz / length) * speed * dt);
}

function moveAxis(
  state: CreatureState,
  world: CreatureWorld | null,
  axis: 'x' | 'z',
  delta: number,
): void {
  if (delta === 0) return;
  const nextX = axis === 'x' ? state.position.x + delta : state.position.x;
  const nextZ = axis === 'z' ? state.position.z + delta : state.position.z;
  if (world !== null && blockedAt(world, nextX, state.position.y, nextZ)) return;
  state.position[axis] += delta;
}

function blockedAt(world: CreatureWorld, x: number, y: number, z: number): boolean {
  const blockX = Math.floor(x);
  const blockZ = Math.floor(z);
  return (
    world.isSolid(blockX, Math.floor(y + 0.1), blockZ) ||
    world.isSolid(blockX, Math.floor(y + 1.2), blockZ)
  );
}

export function spawnAllowed(kind: CreatureKind, ctx: SpawnContext): boolean {
  if (ctx.hostileCount >= MAX_HOSTILES) return false;
  if (ctx.light >= 4) return false;

  if (kind === 'gloomling') {
    return (
      ctx.phase === 'night' &&
      ctx.onSolidGround &&
      ctx.distanceToPlayer >= 16 &&
      ctx.distanceToPlayer <= 40
    );
  }

  if (ctx.phase !== 'night' && !ctx.underground) return false;
  if (ctx.underground) return true;
  return ctx.random() < ctx.emberBias;
}

export function rollDrop(
  kind: CreatureKind,
  random: () => number = Math.random,
): { item: number; count: number } {
  return {
    item: kind === 'gloomling' ? ITEM.GlowDust : ITEM.EmberShard,
    count: Math.floor(random() * 3),
  };
}