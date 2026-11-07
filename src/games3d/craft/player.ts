import { BLOCK, isLiquidBlock, isReplaceable } from './blocks';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerInput {
  /** -1 back to 1 forward, relative to facing. */
  forward: number;
  /** -1 left to 1 right, relative to facing. */
  strafe: number;
  jump: boolean;
  sprint: boolean;
  sneak: boolean;
  mining: boolean;
}

export interface PlayerState {
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  inWater: boolean;
  health: number;
  hunger: number;
  /** Fractional hunger debt accumulated since the last lost point. */
  exhaustion: number;
  fallDistance: number;
  regenTimer: number;
  starveTimer: number;
  hurtTimer: number;
  /** While positive, movement input cannot replace the current horizontal velocity. */
  controlLock: number;
  dead: boolean;
}

/** Minimal world view the player physics needs. */
export interface PlayerWorld {
  isSolid(x: number, y: number, z: number): boolean;
  getBlock(x: number, y: number, z: number): number;
}

export interface PlayerEvents {
  landed: boolean;
  fallDamage: number;
  died: boolean;
}

export const PLAYER_HALF_WIDTH = 0.3;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;
export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;

export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 5.8;
export const SNEAK_SPEED = 1.4;
export const JUMP_SPEED = 8.4;
export const GRAVITY = 28;
export const TERMINAL_VELOCITY = 30;
export const WATER_GRAVITY = 8;
export const SWIM_UP_SPEED = 3;
export const WATER_SINK_SPEED = 4;
export const WATER_DRAG = 0.6;
export const SAFE_FALL = 3;
export const HURT_INVULNERABILITY = 0.4;
export const HUNGER_WALK_SECONDS = 45;
export const HUNGER_SPRINT_SECONDS = 20;
export const HUNGER_MINING_SECONDS = 15;
export const HEALTH_TICK_SECONDS = 4;

const EPSILON = 1e-6;
/** Largest single collision substep, small enough that no block can be tunnelled. */
const MAX_SUBSTEP = 0.25;
/** Binary-search iterations used to settle exactly against a block face. */
const CONTACT_ITERATIONS = 16;

export function createPlayer(position: Vec3, yaw = 0, pitch = 0): PlayerState {
  return {
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    yaw,
    pitch,
    onGround: false,
    inWater: false,
    health: MAX_HEALTH,
    hunger: MAX_HUNGER,
    exhaustion: 0,
    fallDistance: 0,
    regenTimer: 0,
    starveTimer: 0,
    hurtTimer: 0,
    controlLock: 0,
    dead: false,
  };
}

/** Applies damage unless the player is dead or still inside the hurt window. */
export function damagePlayer(state: PlayerState, amount: number): number {
  if (state.dead || amount <= 0 || state.hurtTimer > 0) return 0;
  const applied = Math.min(amount, state.health);
  state.health -= applied;
  state.hurtTimer = HURT_INVULNERABILITY;
  if (state.health <= 0) {
    state.health = 0;
    state.dead = true;
  }
  return applied;
}

/** Restores a dead or stuck player at the world spawn, keeping the inventory. */
export function respawnPlayer(state: PlayerState, spawn: Vec3): void {
  state.position = { ...spawn };
  state.velocity = { x: 0, y: 0, z: 0 };
  state.health = MAX_HEALTH;
  state.hunger = MAX_HUNGER;
  state.exhaustion = 0;
  state.fallDistance = 0;
  state.regenTimer = 0;
  state.starveTimer = 0;
  state.hurtTimer = 0;
  state.controlLock = 0;
  state.onGround = false;
  state.inWater = false;
  state.dead = false;
}

function boxCollides(world: PlayerWorld, position: Vec3): boolean {
  const minX = Math.floor(position.x - PLAYER_HALF_WIDTH + EPSILON);
  const maxX = Math.floor(position.x + PLAYER_HALF_WIDTH - EPSILON);
  const minY = Math.floor(position.y + EPSILON);
  const maxY = Math.floor(position.y + PLAYER_HEIGHT - EPSILON);
  const minZ = Math.floor(position.z - PLAYER_HALF_WIDTH + EPSILON);
  const maxZ = Math.floor(position.z + PLAYER_HALF_WIDTH - EPSILON);

  for (let y = minY; y <= maxY; y += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (world.isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}

function isInWater(world: PlayerWorld, position: Vec3): boolean {
  const feet = world.getBlock(
    Math.floor(position.x),
    Math.floor(position.y + 0.1),
    Math.floor(position.z),
  );
  if (isLiquidBlock(feet)) return true;
  const chest = world.getBlock(
    Math.floor(position.x),
    Math.floor(position.y + 0.9),
    Math.floor(position.z),
  );
  return isLiquidBlock(chest);
}

/**
 * Moves along one axis, substepping to avoid tunnelling and binary-searching the final
 * free position so the player settles exactly against the block face. Returns whether
 * the axis was blocked.
 */
function moveAxis(
  state: PlayerState,
  world: PlayerWorld,
  axis: 'x' | 'y' | 'z',
  delta: number,
): boolean {
  if (delta === 0) return false;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / MAX_SUBSTEP));
  const increment = delta / steps;
  const sign = Math.sign(increment);

  for (let step = 0; step < steps; step += 1) {
    state.position[axis] += increment;
    if (!boxCollides(world, state.position)) continue;

    state.position[axis] -= increment;
    let free = 0;
    let blocked = Math.abs(increment);
    for (let i = 0; i < CONTACT_ITERATIONS; i += 1) {
      const mid = (free + blocked) / 2;
      state.position[axis] = state.position[axis] + sign * mid;
      if (boxCollides(world, state.position)) {
        state.position[axis] -= sign * mid;
        blocked = mid;
      } else {
        state.position[axis] -= sign * mid;
        free = mid;
      }
    }
    state.position[axis] += sign * free;
    return true;
  }
  return false;
}

/** Every footprint corner must rest on a solid block, so sneaking cannot step off. */
function hasFooting(world: PlayerWorld, position: Vec3): boolean {
  const supportY = Math.floor(position.y - 0.05);
  const xs = [position.x - PLAYER_HALF_WIDTH + 0.001, position.x + PLAYER_HALF_WIDTH - 0.001];
  const zs = [position.z - PLAYER_HALF_WIDTH + 0.001, position.z + PLAYER_HALF_WIDTH - 0.001];
  for (const x of xs) {
    for (const z of zs) {
      if (!world.isSolid(Math.floor(x), supportY, Math.floor(z))) return false;
    }
  }
  return true;
}

function moveHorizontal(
  state: PlayerState,
  world: PlayerWorld,
  axis: 'x' | 'z',
  delta: number,
  sneak: boolean,
): boolean {
  if (delta === 0) return false;
  if (sneak && state.onGround) {
    const probe = { ...state.position, [axis]: state.position[axis] + delta };
    if (!hasFooting(world, probe)) return true;
  }
  return moveAxis(state, world, axis, delta);
}

function fallDamageFor(distance: number): number {
  // Accumulated sub-stepping leaves float noise; ignore anything inside a millimetre.
  return Math.max(0, Math.ceil(distance - 0.001) - SAFE_FALL);
}

export function stepPlayer(
  state: PlayerState,
  input: PlayerInput,
  world: PlayerWorld,
  deltaTime: number,
): PlayerEvents {
  const events: PlayerEvents = { landed: false, fallDamage: 0, died: false };
  const dt = Math.min(Math.max(deltaTime, 0), 0.1);
  if (dt === 0) return events;

  state.hurtTimer = Math.max(0, state.hurtTimer - dt);
  state.controlLock = Math.max(0, state.controlLock - dt);
  if (state.dead) return events;

  state.inWater = isInWater(world, state.position);
  if (state.inWater) state.fallDistance = 0;
  const wasGrounded = state.onGround;

  const movingInput = input.forward !== 0 || input.strafe !== 0;
  if (state.controlLock <= 0) {
    const speed = input.sneak
      ? SNEAK_SPEED
      : input.sprint && input.forward > 0
        ? SPRINT_SPEED
        : WALK_SPEED;
    let wishX = input.strafe * Math.cos(state.yaw) - input.forward * Math.sin(state.yaw);
    let wishZ = -input.strafe * Math.sin(state.yaw) - input.forward * Math.cos(state.yaw);
    const length = Math.hypot(wishX, wishZ);
    if (length > 1) {
      wishX /= length;
      wishZ /= length;
    }
    const scale = speed * (state.inWater ? WATER_DRAG : 1);
    const targetX = wishX * scale;
    const targetZ = wishZ * scale;
    if (wasGrounded || state.inWater) {
      state.velocity.x = targetX;
      state.velocity.z = targetZ;
    } else {
      const control = Math.min(1, dt * 6);
      state.velocity.x += (targetX - state.velocity.x) * control;
      state.velocity.z += (targetZ - state.velocity.z) * control;
    }
  }

  if (state.inWater) {
    state.velocity.y = Math.max(
      -WATER_SINK_SPEED,
      state.velocity.y - WATER_GRAVITY * dt,
    );
    if (input.jump) state.velocity.y = SWIM_UP_SPEED;
  } else {
    if (input.jump && state.onGround) {
      state.velocity.y = JUMP_SPEED;
      state.onGround = false;
    }
    state.velocity.y = Math.max(-TERMINAL_VELOCITY, state.velocity.y - GRAVITY * dt);
  }

  if (moveHorizontal(state, world, 'x', state.velocity.x * dt, input.sneak)) {
    state.velocity.x = 0;
  }
  if (moveHorizontal(state, world, 'z', state.velocity.z * dt, input.sneak)) {
    state.velocity.z = 0;
  }

  const previousY = state.position.y;
  const blockedY = moveAxis(state, world, 'y', state.velocity.y * dt);
  if (!wasGrounded && !state.inWater && state.velocity.y < 0) {
    state.fallDistance += Math.max(0, previousY - state.position.y);
  }

  if (blockedY) {
    if (state.velocity.y < 0) {
      state.onGround = true;
      if (!wasGrounded && !state.inWater) {
        const damage = fallDamageFor(state.fallDistance);
        events.landed = true;
        if (damage > 0) {
          events.fallDamage = damagePlayer(state, damage);
          events.died = state.dead;
        }
      }
      state.fallDistance = 0;
    }
    state.velocity.y = 0;
  } else {
    state.onGround = false;
  }

  if (state.hunger > 0) {
    let drain = 0;
    if (input.mining) drain = 1 / HUNGER_MINING_SECONDS;
    else if (movingInput && input.sprint) drain = 1 / HUNGER_SPRINT_SECONDS;
    else if (movingInput) drain = 1 / HUNGER_WALK_SECONDS;
    state.exhaustion += drain * dt;
    if (state.exhaustion >= 1) {
      const lost = Math.floor(state.exhaustion);
      state.hunger = Math.max(0, state.hunger - lost);
      state.exhaustion -= lost;
    }
  }

  if (state.hunger === 0) {
    state.regenTimer = 0;
    state.starveTimer += dt;
    if (state.starveTimer >= HEALTH_TICK_SECONDS) {
      state.starveTimer -= HEALTH_TICK_SECONDS;
      state.health = Math.max(0, state.health - 1);
      if (state.health === 0 && !state.dead) {
        state.dead = true;
        events.died = true;
      }
    }
  } else if (state.hunger >= 16 && state.health < MAX_HEALTH) {
    state.starveTimer = 0;
    state.regenTimer += dt;
    if (state.regenTimer >= HEALTH_TICK_SECONDS) {
      state.regenTimer -= HEALTH_TICK_SECONDS;
      state.health = Math.min(MAX_HEALTH, state.health + 1);
    }
  } else {
    state.regenTimer = 0;
    state.starveTimer = 0;
  }

  return events;
}

function playerBoxIntersects(state: PlayerState, x: number, y: number, z: number): boolean {
  const minX = state.position.x - PLAYER_HALF_WIDTH;
  const maxX = state.position.x + PLAYER_HALF_WIDTH;
  const minZ = state.position.z - PLAYER_HALF_WIDTH;
  const maxZ = state.position.z + PLAYER_HALF_WIDTH;
  return (
    minX < x + 1 &&
    maxX > x &&
    state.position.y < y + 1 &&
    state.position.y + PLAYER_HEIGHT > y &&
    minZ < z + 1 &&
    maxZ > z
  );
}

/** Placement requires an empty, replaceable target outside the player's own box. */
export function canPlaceBlock(
  world: PlayerWorld,
  state: PlayerState,
  x: number,
  y: number,
  z: number,
): boolean {
  if (playerBoxIntersects(state, x, y, z)) return false;
  const existing = world.getBlock(x, y, z);
  if (existing === BLOCK.Air || isReplaceable(existing)) return true;
  return false;
}