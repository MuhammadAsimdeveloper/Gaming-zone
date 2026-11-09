import { describe, expect, it } from 'vitest';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  COMBO_DECAY_TICKS,
  DASH_COOLDOWN_TICKS,
  DASH_TICKS,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  WAVE_COUNT,
  createRun,
  nearestEnemy,
  neutralInput,
  startNextWave,
  stepRun,
  waveComposition,
  type EnemyState,
  type RunInput,
  type RunState,
} from './simulation';

function input(patch: Partial<RunInput> = {}): RunInput {
  return { ...neutralInput(), ...patch };
}

function enemyAt(state: RunState, distance: number, patch: Partial<EnemyState> = {}): EnemyState {
  const enemy: EnemyState = {
    id: 900 + state.enemies.length,
    kind: 'grunt',
    x: state.player.x + distance,
    y: state.player.y,
    health: 40,
    maxHealth: 40,
    radius: 16,
    speed: 70,
    damage: 8,
    attackCooldown: 0,
    stunTicks: 0,
    phase: 1,
    chargeTicks: 0,
    fireCooldown: 90,
    ...patch,
  };
  state.enemies.push(enemy);
  return enemy;
}

function anchorEnemy(state: RunState): EnemyState {
  const anchor = enemyAt(state, 0, { speed: 0 });
  anchor.x = 900;
  anchor.y = 60;
  return anchor;
}

function hostileShot(state: RunState, id = 77): void {
  state.projectiles.push({
    id,
    x: state.player.x + 12,
    y: state.player.y,
    vx: -240,
    vy: 0,
    radius: 6,
    damage: 10,
    hostile: true,
    life: 200,
  });
}

describe('riftfall simulation', () => {
  it('starts wave one with four enemies', () => {
    const state = createRun({ seed: 42, weapon: 'blade' });
    expect(state.status).toBe('fighting');
    expect(state.wave).toBe(1);
    expect(state.enemies).toHaveLength(4);
    expect(state.tick).toBe(0);
    expect(state.player.health).toBe(PLAYER_MAX_HEALTH);
  });

  it('grows every wave and places a boss on waves six and twelve', () => {
    for (let wave = 1; wave <= 11; wave += 1) {
      expect(waveComposition(wave, 42).length).toBeLessThan(waveComposition(wave + 1, 42).length);
    }
    for (const wave of [1, 2, 5, 6, 11, 12]) {
      expect(waveComposition(wave, 42)).toHaveLength(3 + wave);
    }
    expect(waveComposition(6, 42).filter((kind) => kind === 'boss')).toHaveLength(1);
    expect(waveComposition(12, 42).filter((kind) => kind === 'boss')).toHaveLength(1);
    expect(waveComposition(7, 42)).not.toContain('boss');
  });

  it('seeds enemy kinds and spawn points deterministically', () => {
    const first = createRun({ seed: 77, weapon: 'blade' });
    const second = createRun({ seed: 77, weapon: 'blade' });
    const other = createRun({ seed: 78, weapon: 'blade' });
    const snapshot = (state: RunState) => state.enemies.map((enemy) => [enemy.kind, enemy.x, enemy.y]);
    expect(snapshot(first)).toEqual(snapshot(second));
    expect(snapshot(first)).not.toEqual(snapshot(other));
    expect(waveComposition(4, 1234)).toEqual(waveComposition(4, 1234));
  });

  it('clamps player movement to the arena', () => {
    const state = createRun({ seed: 3, weapon: 'blade' });
    state.enemies = [anchorEnemy(state)];
    stepRun(state, input({ moveX: 1 }), 300);
    expect(state.player.x).toBe(ARENA_WIDTH - PLAYER_RADIUS);
    stepRun(state, input({ moveX: -1 }), 300);
    expect(state.player.x).toBe(PLAYER_RADIUS);
    stepRun(state, input({ moveY: 1 }), 300);
    expect(state.player.y).toBe(ARENA_HEIGHT - PLAYER_RADIUS);
    stepRun(state, input({ moveY: -1 }), 300);
    expect(state.player.y).toBe(PLAYER_RADIUS);
  });

  it('grants twelve dash ticks with a thirty-six tick cooldown', () => {
    const state = createRun({ seed: 3, weapon: 'blade' });
    state.enemies = [anchorEnemy(state)];
    stepRun(state, input({ dash: true }), 1);
    expect(state.player.dashTicks).toBe(DASH_TICKS);
    expect(state.player.dashCooldown).toBe(DASH_COOLDOWN_TICKS);
    stepRun(state, neutralInput(), DASH_COOLDOWN_TICKS);
    expect(state.player.dashTicks).toBe(0);
    expect(state.player.dashCooldown).toBe(0);
    stepRun(state, input({ dash: true }), 1);
    expect(state.player.dashTicks).toBe(DASH_TICKS);
  });

  it('ignores hostile projectiles while dashing', () => {
    const state = createRun({ seed: 3, weapon: 'blade' });
    state.enemies = [anchorEnemy(state)];
    hostileShot(state);
    stepRun(state, input({ dash: true }), 1);
    expect(state.player.health).toBe(PLAYER_MAX_HEALTH);
    expect(state.projectiles).toHaveLength(0);
  });

  it('reflects hostile projectiles inside the parry window', () => {
    const state = createRun({ seed: 5, weapon: 'blade' });
    state.enemies = [anchorEnemy(state)];
    hostileShot(state);
    stepRun(state, input({ parry: true }), 1);
    const shot = state.projectiles.find((projectile) => projectile.id === 77);
    expect(shot).toBeDefined();
    expect(shot?.hostile).toBe(false);
    expect(shot?.vx ?? 0).toBeGreaterThan(0);
    expect(state.player.health).toBe(PLAYER_MAX_HEALTH);
  });

  it('stuns a melee enemy that touches a parry', () => {
    const state = createRun({ seed: 5, weapon: 'blade' });
    state.enemies = [enemyAt(state, 30)];
    stepRun(state, input({ parry: true }), 1);
    expect(state.player.health).toBe(PLAYER_MAX_HEALTH);
    expect(state.enemies[0]?.stunTicks ?? 0).toBeGreaterThan(0);
  });

  it('only hits enemies inside weapon range', () => {
    const state = createRun({ seed: 9, weapon: 'blade' });
    const far = enemyAt(state, 300);
    state.enemies = [far];
    stepRun(state, neutralInput(), 90);
    expect(far.health).toBe(40);
    expect(state.score).toBe(0);
    const near = enemyAt(state, 80, { speed: 0 });
    stepRun(state, neutralInput(), 1);
    expect(near.health).toBeLessThan(40);
  });

  it('awards score with the combo multiplier', () => {
    const state = createRun({ seed: 11, weapon: 'rail' });
    const anchor = anchorEnemy(state);
    state.enemies = [anchor];
    for (let kill = 0; kill < 5; kill += 1) {
      state.enemies = [anchor];
      const target = enemyAt(state, 80, { speed: 0, health: 1, maxHealth: 1 });
      stepRun(state, neutralInput(), 45);
      expect(target.health).toBe(0);
    }
    expect(state.combo).toBe(5);
    expect(state.score).toBe(55);
  });

  it('decays the combo after one hundred and eighty idle ticks', () => {
    const state = createRun({ seed: 11, weapon: 'rail' });
    const anchor = anchorEnemy(state);
    state.enemies = [anchor, enemyAt(state, 80, { speed: 0, health: 1, maxHealth: 1 })];
    stepRun(state, neutralInput(), 1);
    expect(state.combo).toBe(1);
    stepRun(state, neutralInput(), COMBO_DECAY_TICKS - 1);
    expect(state.combo).toBe(1);
    stepRun(state, neutralInput(), 1);
    expect(state.combo).toBe(0);
  });

  it('clears a wave only when every enemy is gone', () => {
    const state = createRun({ seed: 4, weapon: 'blade' });
    state.enemies.pop();
    stepRun(state, neutralInput(), 1);
    expect(state.status).toBe('fighting');
    state.enemies = [];
    stepRun(state, neutralInput(), 1);
    expect(state.status).toBe('betweenWaves');
    startNextWave(state);
    expect(state.wave).toBe(2);
    expect(state.status).toBe('fighting');
    expect(state.enemies).toHaveLength(5);
  });

  it('wins when wave twelve is cleared', () => {
    const state = createRun({ seed: 4, weapon: 'blade' });
    state.wave = WAVE_COUNT;
    state.enemies = [];
    stepRun(state, neutralInput(), 1);
    expect(state.status).toBe('won');
  });

  it('loses when health reaches zero', () => {
    const state = createRun({ seed: 13, weapon: 'blade' });
    state.enemies = [enemyAt(state, 30)];
    state.player.health = 6;
    stepRun(state, neutralInput(), 5);
    expect(state.status).toBe('lost');
  });

  it('reports the nearest enemy', () => {
    const state = createRun({ seed: 14, weapon: 'blade' });
    state.enemies = [enemyAt(state, 300, { speed: 0 }), enemyAt(state, 120, { speed: 0 })];
    expect(nearestEnemy(state)?.x).toBe(state.player.x + 120);
    state.enemies = [];
    expect(nearestEnemy(state)).toBeNull();
  });

  it('is deterministic for identical seeds and inputs', () => {
    const first = createRun({ seed: 21, weapon: 'arc' });
    const second = createRun({ seed: 21, weapon: 'arc' });
    for (let frame = 0; frame < 600; frame += 1) {
      const move = input({
        moveX: Math.sin(frame / 30),
        moveY: Math.cos(frame / 45),
        dash: frame % 120 === 0,
        parry: frame % 97 === 0,
      });
      stepRun(first, move, 1);
      stepRun(second, move, 1);
    }
    expect(first.tick).toBe(second.tick);
    expect(first.score).toBe(second.score);
    expect(first.combo).toBe(second.combo);
    expect(first.player.x).toBe(second.player.x);
    expect(first.player.y).toBe(second.player.y);
    expect(first.player.health).toBe(second.player.health);
    expect(first.enemies.map((enemy) => [enemy.kind, enemy.x, enemy.y, enemy.health])).toEqual(
      second.enemies.map((enemy) => [enemy.kind, enemy.x, enemy.y, enemy.health]),
    );
    expect(first.projectiles.map((shot) => [shot.x, shot.y, shot.hostile])).toEqual(
      second.projectiles.map((shot) => [shot.x, shot.y, shot.hostile]),
    );
  });
});
