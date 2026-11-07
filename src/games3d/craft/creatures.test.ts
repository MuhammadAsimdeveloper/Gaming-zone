import { describe, expect, it } from 'vitest';
import { ITEM } from './items';
import {
  CREATURE_STATS,
  MAX_HOSTILES,
  createCreature,
  damageCreature,
  rollDrop,
  spawnAllowed,
  stepCreature,
  type CreatureContext,
  type CreatureEvent,
  type DayPhase,
} from './creatures';

function context(overrides: Partial<CreatureContext> = {}): CreatureContext {
  return {
    player: { position: { x: 0, y: 0, z: 0 }, health: 20 },
    phase: 'night' as DayPhase,
    emberBias: 0.5,
    random: () => 0.5,
    ...overrides,
  };
}

function at(x: number, y = 0, z = 0) {
  return { x, y, z };
}

describe('creature rules', () => {
  it('defines the Gloomling as a short-range chaser with a wind-up', () => {
    const stats = CREATURE_STATS.gloomling;
    expect(stats.sight).toBe(12);
    expect(stats.windup).toBe(0.9);
    expect(stats.damage).toBeGreaterThan(0);
    expect(stats.health).toBeGreaterThan(0);
  });

  it('wanders while the player is out of sight and chases once inside twelve blocks', () => {
    const far = createCreature('gloomling', at(0));
    const farEvents: CreatureEvent[] = [];
    stepCreature(far, null, context({ player: { position: at(20), health: 20 } }), 0.2, farEvents);
    expect(far.mood).toBe('wander');
    expect(farEvents).toHaveLength(0);

    const near = createCreature('gloomling', at(0));
    const nearEvents: CreatureEvent[] = [];
    stepCreature(near, null, context({ player: { position: at(6), health: 20 } }), 1, nearEvents);
    expect(near.mood).toBe('chase');
    expect(near.position.x).toBeGreaterThan(2);
    expect(near.position.x).toBeLessThan(3);
  });

  it('winds up for 0.9 seconds before a melee hit lands', () => {
    const state = createCreature('gloomling', at(0));
    const player = { position: at(1), health: 20 };
    const events: CreatureEvent[] = [];

    stepCreature(state, null, context({ player }), 0.5, events);
    expect(state.mood).toBe('windup');
    expect(events).toHaveLength(0);

    stepCreature(state, null, context({ player }), 0.5, events);
    expect(events).toContainEqual({ type: 'melee', damage: CREATURE_STATS.gloomling.damage });
  });

  it('flees in daylight and despawns at dawn', () => {
    const fleeing = createCreature('gloomling', at(0));
    stepCreature(fleeing, null, context({ player: { position: at(3), health: 20 }, phase: 'day' }), 1, []);
    expect(fleeing.mood).toBe('flee');
    expect(fleeing.position.x).toBeLessThan(0);

    const dawn = createCreature('gloomling', at(0));
    const events: CreatureEvent[] = [];
    stepCreature(dawn, null, context({ player: { position: at(3), health: 20 }, phase: 'dawn' }), 0.1, events);
    expect(events).toContainEqual({ type: 'despawn' });
  });

  it('despawns beyond sixty-four blocks', () => {
    const state = createCreature('cinder-wisp', at(0));
    const events: CreatureEvent[] = [];
    stepCreature(state, null, context({ player: { position: at(65), health: 20 } }), 0.1, events);
    expect(events).toContainEqual({ type: 'despawn' });
  });

  it('keeps the Cinder Wisp between five and eight blocks and fires every 2.5 seconds', () => {
    const far = createCreature('cinder-wisp', at(10));
    stepCreature(far, null, context({ player: { position: at(0), health: 20 } }), 1, []);
    expect(far.position.x).toBeLessThan(10);
    expect(far.position.x).toBeGreaterThan(7);

    const close = createCreature('cinder-wisp', at(4));
    stepCreature(close, null, context({ player: { position: at(0), health: 20 } }), 1, []);
    expect(close.position.x).toBeGreaterThan(4);

    const shooter = createCreature('cinder-wisp', at(6.5));
    const events: CreatureEvent[] = [];
    stepCreature(shooter, null, context({ player: { position: at(0), health: 20 } }), 2.4, events);
    expect(events).toHaveLength(0);
    stepCreature(shooter, null, context({ player: { position: at(0), health: 20 } }), 0.2, events);
    expect(events).toContainEqual({ type: 'ember', damage: CREATURE_STATS['cinder-wisp'].damage });
  });

  it('gates Gloomling spawns to night, darkness, solid ground and 16-40 blocks', () => {
    const spawn = (overrides: Partial<Parameters<typeof spawnAllowed>[1]>) =>
      spawnAllowed('gloomling', {
        light: 3,
        phase: 'night',
        distanceToPlayer: 24,
        onSolidGround: true,
        underground: false,
        emberBias: 0.5,
        hostileCount: 0,
        random: () => 0.5,
        ...overrides,
      });

    expect(spawn({})).toBe(true);
    expect(spawn({ phase: 'day' })).toBe(false);
    expect(spawn({ light: 4 })).toBe(false);
    expect(spawn({ onSolidGround: false })).toBe(false);
    expect(spawn({ distanceToPlayer: 15 })).toBe(false);
    expect(spawn({ distanceToPlayer: 41 })).toBe(false);
    expect(spawn({ hostileCount: MAX_HOSTILES })).toBe(false);
  });

  it('gates Cinder Wisp spawns to night or deep caves with an Ember Ridge bias', () => {
    const spawn = (overrides: Partial<Parameters<typeof spawnAllowed>[1]>) =>
      spawnAllowed('cinder-wisp', {
        light: 3,
        phase: 'night',
        distanceToPlayer: 24,
        onSolidGround: true,
        underground: false,
        emberBias: 0.8,
        hostileCount: 0,
        random: () => 0.5,
        ...overrides,
      });

    expect(spawn({})).toBe(true);
    expect(spawn({ light: 4 })).toBe(false);
    expect(spawn({ phase: 'day' })).toBe(false);
    expect(spawn({ phase: 'day', underground: true })).toBe(true);
    expect(spawn({ phase: 'dusk' })).toBe(false);
    expect(spawn({ random: () => 0.9 })).toBe(false);
    expect(spawn({ emberBias: 0.1, random: () => 0.9 })).toBe(false);
    expect(spawn({ hostileCount: MAX_HOSTILES })).toBe(false);
  });

  it('caps hostile pressure at twelve creatures', () => {
    expect(MAX_HOSTILES).toBe(12);
    expect(spawnAllowed('gloomling', {
      light: 0,
      phase: 'night',
      distanceToPlayer: 20,
      onSolidGround: true,
      underground: false,
      emberBias: 0.5,
      hostileCount: 11,
      random: () => 0,
    })).toBe(true);
  });

  it('drops zero to two materials and reports creature death', () => {
    expect(rollDrop('gloomling', () => 0)).toEqual({ item: ITEM.GlowDust, count: 0 });
    expect(rollDrop('gloomling', () => 0.9)).toEqual({ item: ITEM.GlowDust, count: 2 });
    expect(rollDrop('cinder-wisp', () => 0.5)).toEqual({ item: ITEM.EmberShard, count: 1 });

    const state = createCreature('gloomling', at(0));
    expect(damageCreature(state, 4)).toBe(false);
    expect(state.health).toBe(CREATURE_STATS.gloomling.health - 4);
    expect(damageCreature(state, 100)).toBe(true);
  });
});