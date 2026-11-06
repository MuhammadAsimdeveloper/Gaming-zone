import { describe, expect, it } from 'vitest';
import {
  GRAVITY,
  HOOP_CENTER_X,
  HOOP_Y,
  MAX_ANGLE,
  MAX_POWER,
  MAX_SPEED,
  MIN_ANGLE,
  MIN_POWER,
  MIN_SPEED,
  ROUND_SECONDS,
  SPOTS,
  adjustAim,
  createHoopGame,
  hoopXAt,
  launchVelocity,
  predictPath,
  shootBall,
  shotPoints,
  stepGame,
  streakMultiplier,
  type HoopEvent,
  type HoopState,
  type Rng,
} from './simulation';

function sequence(values: number[]): Rng {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

function aimAt(state: HoopState, targetX: number, targetY: number, flight: number): void {
  const start = SPOTS[state.spot];
  if (!start) throw new Error('missing spot');
  const vx = (targetX - start.x) / flight;
  const vy = (targetY - start.y) / flight - 0.5 * GRAVITY * flight;
  const speed = Math.hypot(vx, vy);
  state.aimAngle = (Math.atan2(-vy, vx) * 180) / Math.PI;
  state.power = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
}

function runUntil(predicate: (state: HoopState) => boolean, state: HoopState, rng: Rng = Math.random): HoopEvent[] {
  const events: HoopEvent[] = [];
  for (let step = 0; step < 1200 && !predicate(state); step += 1) {
    events.push(...stepGame(state, 1 / 60, rng));
  }
  return events;
}

describe('launchVelocity', () => {
  it('scales speed with power and points the ball up and right', () => {
    const low = launchVelocity(45, 0);
    const high = launchVelocity(45, 1);
    expect(Math.hypot(low.vx, low.vy)).toBeCloseTo(MIN_SPEED, 5);
    expect(Math.hypot(high.vx, high.vy)).toBeCloseTo(MAX_SPEED, 5);
    expect(high.vx).toBeGreaterThan(0);
    expect(high.vy).toBeLessThan(0);
    expect(Math.abs(high.vx) - Math.abs(high.vy)).toBeCloseTo(0, 5);
  });

  it('clamps angle and power to the playable range', () => {
    const tooSteep = launchVelocity(200, 5);
    const maxAngle = launchVelocity(MAX_ANGLE, MAX_POWER);
    expect(tooSteep.vx).toBeCloseTo(maxAngle.vx, 5);
    expect(tooSteep.vy).toBeCloseTo(maxAngle.vy, 5);

    const tooFlat = launchVelocity(-90, -4);
    const minAngle = launchVelocity(MIN_ANGLE, MIN_POWER);
    expect(tooFlat.vx).toBeCloseTo(minAngle.vx, 5);
    expect(tooFlat.vy).toBeCloseTo(minAngle.vy, 5);
  });
});

describe('hoop movement', () => {
  it('stays still on rookie', () => {
    expect(hoopXAt(0, 'rookie')).toBe(HOOP_CENTER_X);
    expect(hoopXAt(12.5, 'rookie')).toBe(HOOP_CENTER_X);
  });

  it('oscillates around centre on higher difficulties', () => {
    const peak = hoopXAt(Math.PI / 2 / 1.05, 'pro');
    expect(peak).toBeGreaterThan(HOOP_CENTER_X + 2);
    const tough = hoopXAt(Math.PI / 2 / 1.55, 'allstar');
    expect(tough).toBeGreaterThan(peak);
  });
});

describe('createHoopGame', () => {
  it('starts aiming with a full clock and a seeded spot', () => {
    const state = createHoopGame('rookie', () => 0.5);
    expect(state.phase).toBe('aim');
    expect(state.timeLeft).toBe(ROUND_SECONDS);
    expect(state.spot).toBe(Math.floor(0.5 * SPOTS.length));
    expect(state.aimAngle).toBeGreaterThanOrEqual(MIN_ANGLE);
    expect(state.power).toBeGreaterThanOrEqual(MIN_POWER);
    expect(state.ball.x).toBe(SPOTS[state.spot]!.x);
    expect(state.hoopX).toBe(HOOP_CENTER_X);
  });
});

describe('shooting', () => {
  it('swishes a perfect arc for three points', () => {
    const state = createHoopGame('rookie', () => 0);
    aimAt(state, HOOP_CENTER_X, HOOP_Y, 2);
    expect(shootBall(state)).toBe(true);
    expect(state.phase).toBe('flight');
    expect(state.shots).toBe(1);

    runUntil((current) => current.phase === 'reset', state);
    expect(state.lastResult).toBe('swish');
    expect(state.lastPoints).toBe(3);
    expect(state.score).toBe(3);
    expect(state.makes).toBe(1);
    expect(state.swishes).toBe(1);
    expect(state.streak).toBe(1);
  });

  it('misses a short shot and breaks the streak', () => {
    const state = createHoopGame('rookie', () => 0);
    state.streak = 4;
    state.bestStreak = 4;
    aimAt(state, 44, 70, 1.1);
    expect(shootBall(state)).toBe(true);
    runUntil((current) => current.phase === 'reset', state);
    expect(state.lastResult).toBe('miss');
    expect(state.score).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(4);
    expect(state.makes).toBe(0);
  });

  it('counts a rim contact and never calls it a swish', () => {
    const state = createHoopGame('rookie', () => 0);
    aimAt(state, HOOP_CENTER_X - 5, HOOP_Y, 2);
    expect(shootBall(state)).toBe(true);
    runUntil((current) => current.phase === 'reset', state);
    expect(state.lastResult).not.toBe('swish');
    expect(['rim-in', 'miss']).toContain(state.lastResult);
  });

  it('rejects a second shot while the ball is in flight', () => {
    const state = createHoopGame('rookie', () => 0);
    aimAt(state, HOOP_CENTER_X, HOOP_Y, 2);
    expect(shootBall(state)).toBe(true);
    expect(shootBall(state)).toBe(false);
    expect(state.shots).toBe(1);
  });

  it('resets onto a new spot after the ball settles', () => {
    const rng = sequence([0, 0.75]);
    const state = createHoopGame('rookie', rng);
    expect(state.spot).toBe(0);
    aimAt(state, HOOP_CENTER_X, HOOP_Y, 2);
    expect(shootBall(state)).toBe(true);

    const events = runUntil((current) => current.phase === 'aim', state, rng);
    expect(events).toContain('reset');
    expect(state.spot).toBe(3);
    expect(state.ball.x).toBe(SPOTS[3]!.x);
    expect(state.ball.flying).toBe(false);
  });
});

describe('clock', () => {
  it('ends the round when the clock runs out', () => {
    const state = createHoopGame('rookie', () => 0);
    state.timeLeft = 0.05;
    const events = stepGame(state, 0.1);
    expect(events).toContain('over');
    expect(state.phase).toBe('over');
    expect(state.timeLeft).toBe(0);
    expect(shootBall(state)).toBe(false);
  });

  it('lets a shot finish after the clock hits zero', () => {
    const state = createHoopGame('rookie', () => 0);
    aimAt(state, HOOP_CENTER_X, HOOP_Y, 2);
    state.timeLeft = 0.05;
    expect(shootBall(state)).toBe(true);

    const events = runUntil((current) => current.phase === 'over', state);
    expect(state.lastResult).toBe('swish');
    expect(state.score).toBe(3);
    expect(events).toContain('over');
  });
});

describe('scoring helpers', () => {
  it('multiplies points across a streak', () => {
    expect(shotPoints('swish', 0)).toBe(3);
    expect(shotPoints('swish', 2)).toBe(3);
    expect(shotPoints('swish', 3)).toBe(6);
    expect(shotPoints('rim-in', 5)).toBe(4);
    expect(shotPoints('rim-in', 6)).toBe(6);
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(3)).toBe(2);
    expect(streakMultiplier(6)).toBe(3);
  });

  it('awards streak bonuses in play', () => {
    const state = createHoopGame('rookie', () => 0);
    state.streak = 3;
    state.bestStreak = 3;
    aimAt(state, HOOP_CENTER_X, HOOP_Y, 2);
    shootBall(state);
    runUntil((current) => current.phase === 'reset', state);
    expect(state.score).toBe(6);
    expect(state.streak).toBe(4);
    expect(state.bestStreak).toBe(4);
  });
});

describe('aiming', () => {
  it('clamps aim and power adjustments', () => {
    const state = createHoopGame('rookie', () => 0);
    adjustAim(state, 200, 5);
    expect(state.aimAngle).toBe(MAX_ANGLE);
    expect(state.power).toBe(MAX_POWER);
    adjustAim(state, -400, -9);
    expect(state.aimAngle).toBe(MIN_ANGLE);
    expect(state.power).toBe(MIN_POWER);
  });

  it('predicts the same arc the physics will fly', () => {
    const state = createHoopGame('rookie', () => 0);
    state.aimAngle = 55;
    state.power = 0.6;
    const velocity = launchVelocity(55, 0.6);
    const path = predictPath(state, 4);
    const start = SPOTS[state.spot]!;
    const step = 1 / 30;
    let vx = velocity.vx;
    let vy = velocity.vy;
    let x = start.x;
    let y = start.y;
    for (const point of path) {
      vy += GRAVITY * step;
      x += vx * step;
      y += vy * step;
      expect(point.x).toBeCloseTo(x, 6);
      expect(point.y).toBeCloseTo(y, 6);
    }
  });
});
