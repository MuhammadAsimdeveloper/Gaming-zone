import { describe, expect, it } from 'vitest';
import {
  CHUNK_LENGTH,
  type ObstacleKind,
  type PowerUpKind,
  type Track,
  type WorldObstacle,
  type WorldPowerUp,
  type WorldShard,
  type Lane,
} from './chunks';
import {
  TIME_ATTACK_SECONDS,
  applyRunAction,
  createRun,
  dronePressure,
  multiplierFor,
  scoreFor,
  speedAt,
  stepRun,
  type RunEvent,
  type RunState,
} from './run';

function emptyTrack(chunks = 12): Track {
  return {
    seed: 0,
    chunks: Array.from({ length: chunks }, (_, index) => ({
      index,
      startZ: index * CHUNK_LENGTH,
      obstacles: [],
      shards: [],
      powerups: [],
    })),
    nextIndex: chunks,
    obstacles: [],
    shards: [],
    powerups: [],
  };
}

function obstacle(lane: Lane, kind: ObstacleKind, z: number): WorldObstacle {
  return {
    id: Math.round(z * 10) + lane,
    lane,
    kind,
    z,
    length: kind === 'train' ? 6 : 0.8,
    hit: false,
  };
}

function shard(lane: Lane, z: number): WorldShard {
  return { id: Math.round(z * 10) + lane, lane, z, collected: false };
}

function powerUp(lane: Lane, z: number, kind: PowerUpKind): WorldPowerUp {
  return { id: Math.round(z * 10) + lane + 500, lane, z, kind, collected: false };
}

function runWith(
  obstacles: WorldObstacle[] = [],
  shards: WorldShard[] = [],
  powerups: WorldPowerUp[] = [],
  mode: 'endless' | 'time-attack' = 'endless',
): RunState {
  const track = emptyTrack();
  track.obstacles.push(...obstacles);
  track.shards.push(...shards);
  track.powerups.push(...powerups);
  return createRun(mode, 1, track);
}

function advance(run: RunState, seconds: number, delta = 1 / 120): RunEvent[] {
  const events: RunEvent[] = [];
  const steps = Math.ceil(seconds / delta);
  for (let step = 0; step < steps; step += 1) events.push(...stepRun(run, delta));
  return events;
}

function advanceTo(run: RunState, distance: number): void {
  while (run.distance < distance && !run.ended) stepRun(run, 1 / 120);
}

describe('scoring and speed', () => {
  it('ramps from 12 to 28 units per second and caps there', () => {
    expect(speedAt(0)).toBe(12);
    expect(speedAt(75)).toBe(20);
    expect(speedAt(150)).toBe(28);
    expect(speedAt(300)).toBe(28);
    expect(speedAt(150, true)).toBeGreaterThan(28);
  });

  it('grows the multiplier by a quarter per shard up to six', () => {
    expect(multiplierFor(0)).toBe(1);
    expect(multiplierFor(4)).toBe(2);
    expect(multiplierFor(20)).toBe(6);
    expect(multiplierFor(40)).toBe(6);
  });

  it('scores distance plus shards times the multiplier', () => {
    expect(scoreFor(100, 5, 4)).toBe(200);
    expect(scoreFor(0, 0, 0)).toBe(0);
  });

  it('keeps the live score in sync with the run state', () => {
    const run = runWith();
    advance(run, 2);
    expect(run.score).toBe(scoreFor(run.distance, run.shards, run.combo));
  });
});

describe('obstacle collision', () => {
  it('crashes into a barrier while running', () => {
    const run = runWith([obstacle(1, 'barrier', 10)]);
    advance(run, 2);
    expect(run.crashes).toBe(1);
    expect(run.ended).toBe(false);
  });

  it('clears a barrier while jumping', () => {
    const run = runWith([obstacle(1, 'barrier', 10)]);
    advanceTo(run, 6);
    applyRunAction(run, 'jump');
    advance(run, 2);
    expect(run.crashes).toBe(0);
  });

  it('does not clear a barrier by rolling', () => {
    const run = runWith([obstacle(1, 'barrier', 10)]);
    advanceTo(run, 6);
    applyRunAction(run, 'roll');
    advance(run, 2);
    expect(run.crashes).toBe(1);
  });

  it('clears an overhead gate only by rolling', () => {
    const rollingRun = runWith([obstacle(1, 'gate', 10)]);
    advanceTo(rollingRun, 6);
    applyRunAction(rollingRun, 'roll');
    advance(rollingRun, 2);
    expect(rollingRun.crashes).toBe(0);

    const jumpingRun = runWith([obstacle(1, 'gate', 10)]);
    advanceTo(jumpingRun, 6);
    applyRunAction(jumpingRun, 'jump');
    advance(jumpingRun, 2);
    expect(jumpingRun.crashes).toBe(1);
  });

  it('does not let a jump or roll clear a train', () => {
    const jumpingRun = runWith([obstacle(1, 'train', 10)]);
    advanceTo(jumpingRun, 6);
    applyRunAction(jumpingRun, 'jump');
    advance(jumpingRun, 2);
    expect(jumpingRun.crashes).toBe(1);

    const rollingRun = runWith([obstacle(1, 'train', 10)]);
    advanceTo(rollingRun, 6);
    applyRunAction(rollingRun, 'roll');
    advance(rollingRun, 2);
    expect(rollingRun.crashes).toBe(1);
  });

  it('ignores obstacles in another lane', () => {
    const run = runWith([obstacle(0, 'train', 10), obstacle(2, 'train', 10)]);
    advance(run, 2);
    expect(run.crashes).toBe(0);
  });

  it('catches a thin obstacle at full speed with a swept check', () => {
    const run = runWith([obstacle(1, 'barrier', 10)]);
    run.elapsed = 200;
    advance(run, 1, 0.05);
    expect(run.crashes).toBe(1);
  });
});

describe('power-ups', () => {
  it('absorbs one hit with a shield', () => {
    const run = runWith([obstacle(1, 'barrier', 12)], [], [powerUp(1, 2, 'shield')]);
    advance(run, 0.4);
    expect(run.shield).toBe(true);
    advance(run, 0.7);
    expect(run.shield).toBe(false);
    expect(run.crashes).toBe(0);
    expect(run.invulnerable).toBeGreaterThan(0);
  });

  it('passes through obstacles during overdrive', () => {
    const run = runWith([obstacle(1, 'train', 10)], [], [powerUp(1, 2, 'overdrive')]);
    advance(run, 0.4);
    expect(run.overdriveTimer).toBeGreaterThan(5);
    advance(run, 2);
    expect(run.crashes).toBe(0);
  });

  it('collects adjacent-lane shards only with the magnet', () => {
    const withoutMagnet = runWith([], [shard(0, 10)]);
    advance(withoutMagnet, 2);
    expect(withoutMagnet.shards).toBe(0);

    const withMagnet = runWith([], [shard(0, 10)], [powerUp(1, 2, 'magnet')]);
    advance(withMagnet, 2);
    expect(withMagnet.shards).toBe(1);
  });

  it('expires power-up timers', () => {
    const run = runWith([], [], [powerUp(1, 2, 'magnet')]);
    advance(run, 0.4);
    expect(run.magnetTimer).toBeGreaterThan(7.5);
    advance(run, 8);
    expect(run.magnetTimer).toBe(0);
  });
});

describe('run lifecycle', () => {
  it('ends an endless run on the second crash', () => {
    const run = runWith([obstacle(1, 'barrier', 10), obstacle(1, 'barrier', 40)]);
    advance(run, 12);
    expect(run.crashes).toBe(2);
    expect(run.ended).toBe(true);
    expect(run.endReason).toBe('drone');
  });

  it('charges two seconds per crash in time attack instead of ending', () => {
    const run = runWith([obstacle(1, 'barrier', 10)], [], [], 'time-attack');
    advance(run, 2);
    expect(run.crashes).toBe(1);
    expect(run.ended).toBe(false);
    expect(run.timeLeft).toBeLessThanOrEqual(TIME_ATTACK_SECONDS - 4 + 0.5);
    expect(run.timeLeft).toBeGreaterThan(TIME_ATTACK_SECONDS - 4.5);
  });

  it('ends a time attack when the clock runs out', () => {
    const run = runWith([], [], [], 'time-attack');
    run.timeLeft = 0.5;
    advance(run, 1);
    expect(run.ended).toBe(true);
    expect(run.endReason).toBe('time');
  });

  it('resets the combo after four seconds without a shard', () => {
    const run = runWith([], [shard(1, 2)]);
    advance(run, 0.4);
    expect(run.combo).toBe(1);
    advance(run, 4.1);
    expect(run.combo).toBe(0);
  });

  it('resets the combo on a crash', () => {
    const run = runWith([obstacle(1, 'barrier', 10)], [shard(1, 2)]);
    advance(run, 2);
    expect(run.shards).toBe(1);
    expect(run.crashes).toBe(1);
    expect(run.combo).toBe(0);
  });

  it('ignores actions after the run ends', () => {
    const run = runWith();
    run.ended = true;
    expect(applyRunAction(run, 'right')).toBe(false);
    expect(run.player.lane).toBe(1);
  });

  it('raises drone pressure with crashes', () => {
    const clean = runWith();
    advance(clean, 2);
    const crashed = runWith([obstacle(1, 'barrier', 10)]);
    advance(crashed, 2);
    expect(dronePressure(crashed)).toBeGreaterThan(dronePressure(clean));
  });
});
