import { describe, expect, it } from 'vitest';
import {
  COLS,
  ENEMIES,
  LANES,
  LEVELS,
  MODULES,
  MODULE_ORDER,
  validateLevel,
  type LevelDef,
} from './content';
import {
  cellAt,
  cellIndex,
  collectLight,
  createGame,
  plant,
  shovel,
  spawnEnemy,
  starsFor,
  stepGame,
  type LawnState,
} from './simulation';

const STEP = 1 / 60;

function tinyLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test-field',
    name: 'Test Field',
    theme: 'solar',
    blurb: 'A test rooftop.',
    startingLight: 500,
    skyInterval: 8,
    hpScale: 1,
    speedScale: 1,
    waves: [],
    ...overrides,
  };
}

function game(level: LevelDef = tinyLevel()): LawnState {
  return createGame({ level, seed: 7, mode: 'campaign' });
}

function advance(state: LawnState, seconds: number): ReturnType<typeof stepGame> {
  const events: ReturnType<typeof stepGame> = [];
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) events.push(...stepGame(state, STEP));
  return events;
}

function charge(state: LawnState, moduleId: keyof typeof MODULES): void {
  state.recharge[moduleId] = 0;
}

describe('content data', () => {
  it('ships eight modules and ten enemies with distinct ids', () => {
    expect(MODULE_ORDER).toHaveLength(8);
    expect(Object.keys(MODULES)).toHaveLength(8);
    expect(Object.keys(ENEMIES)).toHaveLength(10);
    expect(new Set(MODULE_ORDER).size).toBe(8);
  });

  it('ships twelve valid campaign levels with unique ids and rising difficulty', () => {
    expect(LEVELS).toHaveLength(12);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(12);
    for (const level of LEVELS) {
      expect(validateLevel(level)).toEqual([]);
      expect(level.waves.length).toBeGreaterThan(0);
    }
    const first = LEVELS[0];
    const last = LEVELS[LEVELS.length - 1];
    expect(last.hpScale).toBeGreaterThan(first.hpScale);
    expect(last.waves.some((wave) => wave.enemy === 'boss')).toBe(true);
    expect(first.waves.some((wave) => wave.enemy === 'walker')).toBe(true);
  });

  it('rejects malformed level data with specific issues', () => {
    expect(validateLevel(tinyLevel({ waves: [] }))).toContain('level has no waves');
    expect(
      validateLevel(
        tinyLevel({
          waves: [{ at: 5, lane: 9, enemy: 'walker', count: 1, spacing: 1 }],
        }),
      ).some((issue) => issue.includes('lane out of range')),
    ).toBe(true);
    expect(
      validateLevel(
        tinyLevel({
          waves: [{ at: 0, lane: 0, enemy: 'walker', count: 0, spacing: 1 }],
        }),
      ).some((issue) => issue.includes('count')),
    ).toBe(true);
  });
});

describe('createGame', () => {
  it('starts a campaign state with light, purges, cooldowns and an expanded spawn queue', () => {
    const level = LEVELS[0];
    const state = createGame({ level, seed: 3, mode: 'campaign' });
    expect(state.status).toBe('running');
    expect(state.light).toBe(level.startingLight);
    expect(state.purges).toEqual([true, true, true, true, true]);
    expect(state.purgesUsed).toBe(0);
    expect(state.grid).toHaveLength(LANES * COLS);
    expect(state.grid.every((cell) => cell === null)).toBe(true);
    expect(state.recharge[MODULE_ORDER[0]]).toBe(0);
    expect(state.queue.length).toBe(
      level.waves.reduce((total, wave) => total + wave.count, 0),
    );
    expect(state.waveStartTimes.length).toBeGreaterThan(0);
    expect(state.endless).toBeNull();
  });

  it('does not remove the grid cell of a planted module from other lanes', () => {
    const state = game();
    charge(state, 'photofern');
    expect(plant(state, 'photofern', 2, 4).ok).toBe(true);
    expect(cellAt(state, 2, 4)?.moduleId).toBe('photofern');
    expect(cellAt(state, 2, 5)).toBeNull();
    expect(cellAt(state, 1, 4)).toBeNull();
    expect(cellIndex(4, 2)).toBe(4 * COLS + 2);
  });
});

describe('planting, cooldowns and shovels', () => {
  it('charges light, sets recharge and records the action', () => {
    const state = game();
    charge(state, 'needle-pod');
    const result = plant(state, 'needle-pod', 1, 2);
    expect(result.ok).toBe(true);
    expect(result.events).toContainEqual({ type: 'plant', moduleId: 'needle-pod', lane: 1, col: 2 });
    expect(state.light).toBe(500 - MODULES['needle-pod'].cost);
    expect(state.recharge['needle-pod']).toBe(MODULES['needle-pod'].recharge);
    expect(cellAt(state, 1, 2)?.moduleId).toBe('needle-pod');
  });

  it('rejects out-of-bounds, occupied, unaffordable and recharging placements', () => {
    const state = game();
    charge(state, 'rind-wall');
    expect(plant(state, 'rind-wall', -1, 0)).toMatchObject({ ok: false, reason: 'bounds' });
    expect(plant(state, 'rind-wall', 0, COLS)).toMatchObject({ ok: false, reason: 'bounds' });
    expect(plant(state, 'rind-wall', 0, 0).ok).toBe(true);
    expect(plant(state, 'rind-wall', 0, 0)).toMatchObject({ ok: false, reason: 'occupied' });
    expect(plant(state, 'rind-wall', 1, 0)).toMatchObject({ ok: false, reason: 'recharge' });

    const broke = game();
    broke.light = MODULES['mortar-moss'].cost - 1;
    charge(broke, 'mortar-moss');
    expect(plant(broke, 'mortar-moss', 0, 0)).toMatchObject({ ok: false, reason: 'light' });
    expect(broke.light).toBe(MODULES['mortar-moss'].cost - 1);
  });

  it('clears recharge over time and allows a second placement', () => {
    const state = game();
    charge(state, 'photofern');
    expect(plant(state, 'photofern', 0, 0).ok).toBe(true);
    expect(plant(state, 'photofern', 0, 1).ok).toBe(false);
    advance(state, MODULES.photofern.recharge + 0.05);
    expect(state.recharge.photofern).toBe(0);
    expect(plant(state, 'photofern', 0, 1).ok).toBe(true);
  });

  it('shovels for a fifty percent refund and rejects empty cells', () => {
    const state = game();
    charge(state, 'burst-bloom');
    expect(plant(state, 'burst-bloom', 3, 3).ok).toBe(true);
    const before = state.light;
    const result = shovel(state, 3, 3);
    expect(result.ok).toBe(true);
    expect(result.events).toContainEqual({
      type: 'shovel',
      moduleId: 'burst-bloom',
      refund: Math.floor(MODULES['burst-bloom'].cost / 2),
    });
    expect(state.light).toBe(before + Math.floor(MODULES['burst-bloom'].cost / 2));
    expect(cellAt(state, 3, 3)).toBeNull();
    expect(shovel(state, 3, 3)).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('refuses actions once the level has ended', () => {
    const state = game();
    state.status = 'lost';
    expect(plant(state, 'photofern', 0, 0)).toMatchObject({ ok: false, reason: 'phase' });
    expect(shovel(state, 0, 0)).toMatchObject({ ok: false, reason: 'phase' });
  });
});

describe('light economy', () => {
  it('places collectable sky light on a schedule', () => {
    const state = game(tinyLevel({ skyInterval: 2 }));
    advance(state, 2.05);
    expect(state.tokens.some((token) => token.source === 'sky')).toBe(true);
    const token = state.tokens[0];
    const before = state.light;
    expect(collectLight(state, token.id).ok).toBe(true);
    expect(state.light).toBe(before + token.value);
    expect(state.tokens.find((candidate) => candidate.id === token.id)).toBeUndefined();
    expect(collectLight(state, token.id)).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('lets photoferns produce their own light tokens', () => {
    const state = game();
    charge(state, 'photofern');
    plant(state, 'photofern', 0, 2);
    advance(state, 0.05);
    const token = state.tokens.find((candidate) => candidate.source === 'module');
    expect(token).toBeDefined();
    expect(token?.lane).toBe(0);
    expect(token?.col).toBe(2);
  });

  it('expires uncollected tokens instead of letting them pile up', () => {
    const state = game(tinyLevel({ skyInterval: 2 }));
    advance(state, 2.05);
    expect(state.tokens).toHaveLength(1);
    const first = state.tokens[0];
    advance(state, 10);
    expect(state.tokens.find((token) => token.id === first.id)).toBeUndefined();
  });
});

describe('combat', () => {
  it('needle pods shoot the first enemy ahead in their lane and not behind', () => {
    const state = game();
    charge(state, 'needle-pod');
    plant(state, 'needle-pod', 2, 1);
    spawnEnemy(state, { lane: 2, x: 5, enemyId: 'walker', freeze: true });
    spawnEnemy(state, { lane: 2, x: 0.4, enemyId: 'walker', freeze: true });
    advance(state, 2);
    const ahead = state.enemies.find((enemy) => enemy.x > 4);
    const behind = state.enemies.find((enemy) => enemy.x < 1);
    expect(ahead?.health).toBeLessThan(ENEMIES.walker.health);
    expect(behind?.health).toBe(ENEMIES.walker.health);
  });

  it('blocks enemies at a rind wall until the wall breaks', () => {
    const state = game();
    charge(state, 'rind-wall');
    plant(state, 'rind-wall', 0, 3);
    const enemy = spawnEnemy(state, { lane: 0, x: 4.2, enemyId: 'walker' });
    advance(state, 2);
    const wall = cellAt(state, 0, 3);
    expect(wall).not.toBeNull();
    expect(wall!.health).toBeLessThan(wall!.maxHealth);
    expect(enemy.x).toBeGreaterThan(3);
    expect(enemy.x).toBeLessThan(4);
    expect(enemy.x).toBeCloseTo(4, 1);

    wall!.health = 1;
    advance(state, 1);
    expect(cellAt(state, 0, 3)).toBeNull();
    expect(enemy.x).toBeLessThan(3.9);
  });

  it('respects the mortar minimum range', () => {
    const close = game();
    charge(close, 'mortar-moss');
    plant(close, 'mortar-moss', 0, 6);
    spawnEnemy(close, { lane: 0, x: 7.2, enemyId: 'walker', freeze: true });
    advance(close, 1.5);
    expect(close.projectiles.some((projectile) => projectile.kind === 'mortar')).toBe(false);

    const far = game();
    charge(far, 'mortar-moss');
    plant(far, 'mortar-moss', 0, 6);
    const target = spawnEnemy(far, { lane: 0, x: 8.9, enemyId: 'walker', freeze: true });
    advance(far, 1.5);
    expect(far.projectiles.some((projectile) => projectile.kind === 'mortar')).toBe(false);
    expect(target.health).toBeLessThan(ENEMIES.walker.health);
  });

  it('frost caps slow a whole lane', () => {
    const state = game();
    charge(state, 'frost-cap');
    plant(state, 'frost-cap', 1, 4);
    const near = spawnEnemy(state, { lane: 1, x: 7, enemyId: 'walker' });
    const far = spawnEnemy(state, { lane: 1, x: 8.5, enemyId: 'walker' });
    advance(state, 0.1);
    expect(near.slowUntil).toBeGreaterThan(state.time);
    expect(far.slowUntil).toBeGreaterThan(state.time);
  });

  it('ember vines burn enemies inside their tile', () => {
    const state = game();
    charge(state, 'ember-vine');
    plant(state, 'ember-vine', 3, 5);
    const burning = spawnEnemy(state, { lane: 3, x: 5.4, enemyId: 'walker', freeze: true });
    const safe = spawnEnemy(state, { lane: 3, x: 8.5, enemyId: 'walker', freeze: true });
    advance(state, 1);
    expect(burning.health).toBeLessThan(ENEMIES.walker.health);
    expect(safe.health).toBe(ENEMIES.walker.health);
  });

  it('lets shielded enemies absorb damage before their health', () => {
    const state = game();
    charge(state, 'needle-pod');
    plant(state, 'needle-pod', 0, 1);
    const enemy = spawnEnemy(state, { lane: 0, x: 4, enemyId: 'shielded', freeze: true });
    enemy.health = 5;
    advance(state, 1);
    expect(enemy.shield).toBeLessThan(90);
    expect(enemy.health).toBe(5);
    enemy.shield = 0;
    advance(state, 2);
    expect(state.enemies.includes(enemy)).toBe(false);
  });

  it('splits splitters into two walkers when they die', () => {
    const state = game();
    charge(state, 'needle-pod');
    plant(state, 'needle-pod', 0, 1);
    const splitter = spawnEnemy(state, { lane: 0, x: 4, enemyId: 'splitter', freeze: true });
    splitter.health = 5;
    advance(state, 1.2);
    expect(state.enemies.includes(splitter)).toBe(false);
    const children = state.enemies.filter((enemy) => enemy.enemyId === 'walker');
    expect(children).toHaveLength(2);
    expect(children.every((enemy) => enemy.x > 3)).toBe(true);
  });

  it('healers restore nearby enemies', () => {
    const state = game();
    const patient = spawnEnemy(state, { lane: 0, x: 8.4, enemyId: 'walker', freeze: true });
    patient.health = 20;
    spawnEnemy(state, { lane: 0, x: 8.8, enemyId: 'healer', freeze: true });
    advance(state, 2.2);
    expect(patient.health).toBeGreaterThan(20);
    expect(patient.health).toBeLessThanOrEqual(patient.maxHealth);
  });

  it('ranged enemies stop and shoot modules from a distance', () => {
    const state = game();
    charge(state, 'rind-wall');
    plant(state, 'rind-wall', 2, 4);
    const enemy = spawnEnemy(state, { lane: 2, x: 8.6, enemyId: 'ranged' });
    advance(state, 2.8);
    const wall = cellAt(state, 2, 4);
    expect(wall!.health).toBeLessThan(wall!.maxHealth);
    expect(enemy.x).toBeGreaterThan(7);
  });

  it('jumpers and burrowers bypass the first blocker once', () => {
    for (const enemyId of ['jumper', 'burrower'] as const) {
      const state = game();
      charge(state, 'rind-wall');
      plant(state, 'rind-wall', 1, 4);
      const enemy = spawnEnemy(state, { lane: 1, x: 5.1, enemyId });
      advance(state, 3);
      expect(cellAt(state, 1, 4)?.health).toBe(cellAt(state, 1, 4)?.maxHealth);
      expect(enemy.x).toBeLessThan(4);
      expect(enemy.abilityUsed).toBe(true);
    }
  });
});

describe('lane purges, loss and victory', () => {
  it('uses a lane purge on breach, then loses on the next breach', () => {
    const state = game(
      tinyLevel({ waves: [{ at: 100, lane: 0, enemy: 'walker', count: 1, spacing: 1 }] }),
    );
    const breacher = spawnEnemy(state, { lane: 4, x: 0.01, enemyId: 'walker' });
    advance(state, 0.2);
    expect(state.purges[4]).toBe(false);
    expect(state.purgesUsed).toBe(1);
    expect(state.enemies.includes(breacher)).toBe(false);
    expect(state.status).toBe('running');

    spawnEnemy(state, { lane: 4, x: 0.01, enemyId: 'walker' });
    advance(state, 0.2);
    expect(state.status).toBe('lost');
    expect(state.purgesUsed).toBe(1);
  });

  it('wins when the queue is empty and the field is clear', () => {
    const state = game();
    charge(state, 'needle-pod');
    plant(state, 'needle-pod', 0, 1);
    const enemy = spawnEnemy(state, { lane: 0, x: 4, enemyId: 'walker', freeze: true });
    enemy.health = 5;
    const events = advance(state, 4);
    expect(state.status).toBe('won');
    expect(events.some((event) => event.type === 'win' && event.stars === 3)).toBe(true);
    expect(state.kills).toBe(1);
  });

  it('emits exactly one terminal event', () => {
    const state = game();
    state.purges = [false, false, false, false, false];
    spawnEnemy(state, { lane: 0, x: 0.01, enemyId: 'walker' });
    const first = advance(state, 0.2);
    expect(first.some((event) => event.type === 'lose')).toBe(true);
    expect(state.status).toBe('lost');
    expect(advance(state, 5)).toHaveLength(0);
  });

  it('grades stars by purges used', () => {
    const state = game();
    expect(starsFor({ ...state, purgesUsed: 0 })).toBe(3);
    expect(starsFor({ ...state, purgesUsed: 1 })).toBe(2);
    expect(starsFor({ ...state, purgesUsed: 2 })).toBe(2);
    expect(starsFor({ ...state, purgesUsed: 3 })).toBe(1);
  });

  it('emits wave telegraphs once, including the final wave', () => {
    const level = tinyLevel({
      waves: [
        { at: 0.5, lane: 0, enemy: 'walker', count: 1, spacing: 1 },
        { at: 1.5, lane: 1, enemy: 'runner', count: 1, spacing: 1 },
      ],
    });
    const state = game(level);
    const events = advance(state, 2);
    const waves = events.filter((event) => event.type === 'wave');
    expect(waves).toHaveLength(2);
    expect(waves[0]).toMatchObject({ wave: 1, final: false });
    expect(waves[1]).toMatchObject({ wave: 2, final: true });
    expect(state.finalWave).toBe(true);
  });
});

describe('determinism and endless mode', () => {
  it('produces identical states from the same seed', () => {
    const level = tinyLevel({ skyInterval: 1.5 });
    const a = createGame({ level, seed: 99, mode: 'campaign' });
    const b = createGame({ level, seed: 99, mode: 'campaign' });
    advance(a, 8);
    advance(b, 8);
    expect(a.tokens).toEqual(b.tokens);
    expect(a.rngState).toBe(b.rngState);
    expect(a.time).toBeCloseTo(b.time, 6);
  });

  it('extends endless mode with escalating waves instead of declaring victory', () => {
    const state = createGame({ level: LEVELS[0], seed: 5, mode: 'endless' });
    expect(state.endless).not.toBeNull();
    advance(state, 30);
    expect(state.status).toBe('running');
    expect(state.waveStartTimes.length).toBeGreaterThanOrEqual(1);
    expect(state.enemies.length + state.queue.length).toBeGreaterThan(0);
    expect(state.finalWave).toBe(false);
  });
});
