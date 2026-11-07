import { describe, expect, it } from 'vitest';
import { BLOCK, isSolidBlock } from './blocks';
import {
  GRAVITY,
  MAX_HEALTH,
  MAX_HUNGER,
  PLAYER_HALF_WIDTH,
  createPlayer,
  damagePlayer,
  canPlaceBlock,
  respawnPlayer,
  stepPlayer,
  type PlayerInput,
  type PlayerState,
  type PlayerWorld,
} from './player';

interface WorldOptions {
  solid?: (x: number, y: number, z: number) => boolean;
  liquid?: (x: number, y: number, z: number) => boolean;
  floor?: boolean;
}

function makeWorld(options: WorldOptions = {}): PlayerWorld {
  const floor = options.floor ?? true;
  const getBlock = (x: number, y: number, z: number): number => {
    if (options.liquid?.(x, y, z)) return BLOCK.Water;
    if ((floor && y <= 0) || options.solid?.(x, y, z)) return BLOCK.Stone;
    return BLOCK.Air;
  };
  return { getBlock, isSolid: (x, y, z) => isSolidBlock(getBlock(x, y, z)) };
}

const idle: PlayerInput = {
  forward: 0,
  strafe: 0,
  jump: false,
  sprint: false,
  sneak: false,
  mining: false,
};

function input(overrides: Partial<PlayerInput>): PlayerInput {
  return { ...idle, ...overrides };
}

const STEP = 1 / 60;

function run(
  player: PlayerState,
  playerInput: PlayerInput,
  world: PlayerWorld,
  seconds: number,
): void {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepPlayer(player, playerInput, world, STEP);
}

function at(x: number, y: number, z: number): PlayerState {
  return createPlayer({ x, y, z });
}

describe('player movement', () => {
  it('falls under gravity and settles on the block floor', () => {
    const world = makeWorld();
    const player = at(0.5, 5, 0.5);

    run(player, idle, world, 2);

    expect(player.onGround).toBe(true);
    expect(player.position.y).toBeCloseTo(1, 4);
    expect(player.velocity.y).toBe(0);
  });

  it('walks at the walk speed along the facing direction', () => {
    const world = makeWorld();
    const player = at(0.5, 1, 0.5);

    run(player, input({ forward: 1 }), world, 1);

    expect(player.position.z).toBeLessThan(0.5 - 4.2);
    expect(player.position.z).toBeGreaterThan(0.5 - 4.4);
    expect(player.position.x).toBeCloseTo(0.5, 5);
  });

  it('sprints faster than it walks', () => {
    const world = makeWorld();
    const walker = at(0.5, 1, 0.5);
    const sprinter = at(0.5, 1, 0.5);

    run(walker, input({ forward: 1 }), world, 1);
    run(sprinter, input({ forward: 1, sprint: true }), world, 1);

    expect(0.5 - sprinter.position.z).toBeGreaterThan(0.5 - walker.position.z + 1);
  });

  it('jumps off the ground and lands again', () => {
    const world = makeWorld();
    const player = at(0.5, 1, 0.5);
    let peak = player.position.y;

    run(player, input({ jump: true }), world, 0.1);
    for (let i = 0; i < 120; i += 1) {
      stepPlayer(player, idle, world, STEP);
      peak = Math.max(peak, player.position.y);
    }

    expect(peak).toBeGreaterThan(2);
    expect(player.onGround).toBe(true);
    expect(player.position.y).toBeCloseTo(1, 4);
  });

  it('stops against a wall instead of passing through it', () => {
    const world = makeWorld({ solid: (_x, y, z) => y === 1 && z === -1 });
    const player = at(0.5, 1, 0.5);

    run(player, input({ forward: 1 }), world, 2);

    expect(player.position.z).toBeGreaterThan(0.29);
    expect(player.position.z).toBeLessThan(0.31);
    expect(player.velocity.z).toBe(0);
  });
});

describe('player survival', () => {
  it('takes no damage from a fall of three blocks or less', () => {
    const world = makeWorld();
    const player = at(0.5, 4, 0.5);

    run(player, idle, world, 2);

    expect(player.onGround).toBe(true);
    expect(player.health).toBe(MAX_HEALTH);
  });

  it('takes fall damage after a long drop', () => {
    const world = makeWorld();
    const player = at(0.5, 12, 0.5);
    let landedDamage = 0;
    let landed = false;

    for (let i = 0; i < 180; i += 1) {
      const events = stepPlayer(player, idle, world, STEP);
      if (events.landed) {
        landed = true;
        landedDamage = events.fallDamage;
      }
    }

    expect(landed).toBe(true);
    expect(landedDamage).toBe(8);
    expect(player.health).toBe(MAX_HEALTH - 8);
  });

  it('swims with reduced gravity and a capped ascent', () => {
    const world = makeWorld({ liquid: (_x, y, _z) => y >= 1 && y <= 4 });
    const player = at(0.5, 3, 0.5);

    run(player, input({ jump: true }), world, 0.5);

    expect(player.inWater).toBe(true);
    expect(player.velocity.y).toBeGreaterThan(0);
    expect(player.velocity.y).toBeLessThanOrEqual(3);

    const sinker = at(0.5, 3, 0.5);
    run(sinker, idle, world, 0.5);
    expect(sinker.velocity.y).toBeGreaterThanOrEqual(-4.01);
    expect(sinker.velocity.y).toBeLessThan(0);
    expect(GRAVITY).toBeGreaterThan(4);
  });

  it('drains one hunger after 45 seconds of walking', () => {
    const world = makeWorld();
    const player = at(0.5, 1, 0.5);

    run(player, input({ forward: 1 }), world, 46);

    expect(player.hunger).toBe(MAX_HUNGER - 1);
  });

  it('drains hunger faster while sprinting', () => {
    const world = makeWorld();
    const player = at(0.5, 1, 0.5);

    run(player, input({ forward: 1, sprint: true }), world, 21);

    expect(player.hunger).toBe(MAX_HUNGER - 1);
  });

  it('drains hunger while mining even when standing still', () => {
    const world = makeWorld();
    const player = at(0.5, 1, 0.5);

    run(player, input({ mining: true }), world, 16);

    expect(player.hunger).toBe(MAX_HUNGER - 1);
  });

  it('loses health when starving at zero hunger', () => {
    const world = makeWorld();
    const player = at(0.5, 1, 0.5);
    player.hunger = 0;

    run(player, idle, world, 4.2);

    expect(player.health).toBe(MAX_HEALTH - 1);
  });

  it('regenerates health when hunger is at least 16', () => {
    const world = makeWorld();
    const player = at(0.5, 1, 0.5);
    player.health = 10;
    player.hunger = 16;

    run(player, idle, world, 4.2);

    expect(player.health).toBe(11);
  });

  it('grants brief invulnerability after taking damage', () => {
    const world = makeWorld();
    const player = at(0.5, 1, 0.5);

    expect(damagePlayer(player, 3)).toBe(3);
    expect(damagePlayer(player, 3)).toBe(0);
    expect(player.health).toBe(MAX_HEALTH - 3);

    run(player, idle, world, 0.5);
    expect(damagePlayer(player, 3)).toBe(3);
    expect(player.health).toBe(MAX_HEALTH - 6);
  });

  it('respawns with full health and hunger at the spawn point', () => {
    const player = at(0.5, 1, 0.5);
    player.health = 0;
    player.hunger = 0;
    player.velocity.x = 3;
    player.position.y = 30;

    respawnPlayer(player, { x: 8, y: 12, z: -4 });

    expect(player.health).toBe(MAX_HEALTH);
    expect(player.hunger).toBe(MAX_HUNGER);
    expect(player.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(player.position).toEqual({ x: 8, y: 12, z: -4 });
    expect(player.dead).toBe(false);
  });
});

describe('player interaction rules', () => {
  it('refuses to walk off a ledge while sneaking', () => {
    const world = makeWorld({ floor: false, solid: (x, y) => y === 0 && x <= 0 });
    const player = at(-1, 1, 0.5);

    run(player, input({ forward: 0, strafe: 1, sneak: true }), world, 3);

    expect(player.position.y).toBeCloseTo(1, 4);
    expect(player.position.x).toBeLessThan(0.71);
  });

  it('walks off the same ledge when not sneaking', () => {
    const world = makeWorld({ floor: false, solid: (x, y) => y === 0 && x <= 0 });
    const player = at(-1, 1, 0.5);

    run(player, input({ strafe: 1 }), world, 3);

    expect(player.position.y).toBeLessThan(0.5);
  });

  it('rejects placement inside the player box or on non-replaceable blocks', () => {
    const world = makeWorld();
    const player = at(0.5, 1, 0.5);

    expect(PLAYER_HALF_WIDTH).toBe(0.3);
    expect(canPlaceBlock(world, player, 0, 1, 0)).toBe(false);
    expect(canPlaceBlock(world, player, 0, 2, 0)).toBe(false);
    expect(canPlaceBlock(world, player, 0, 0, 0)).toBe(false);
    expect(canPlaceBlock(world, player, 2, 1, 2)).toBe(true);
    expect(canPlaceBlock(world, player, 0, 4, 0)).toBe(true);
  });
});