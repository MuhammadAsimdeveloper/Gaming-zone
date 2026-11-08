import { describe, expect, it } from 'vitest';
import { advanceClock, completeClockMove, createClock, pauseClock, resumeClock, startClock } from './clock';

describe('Rift Chess clock', () => {
  it('starts with equal clocks and the selected side active', () => {
    expect(createClock(60_000, 2_000, 'b')).toMatchObject({
      remainingMs: { w: 60_000, b: 60_000 }, active: 'b', incrementMs: 2_000, running: false,
    });
  });

  it('decreases from monotonic elapsed time and not from interval count', () => {
    const started = startClock(createClock(10_000), 500);
    expect(advanceClock(started, 2_000).remainingMs.w).toBe(8_500);
  });

  it('awards increment to the mover and switches active side', () => {
    const started = startClock(createClock(10_000, 2_000), 0);
    const switched = completeClockMove(started, 'b', 3_000);
    expect(switched).toMatchObject({
      remainingMs: { w: 9_000, b: 10_000 }, active: 'b', running: true, lastUpdatedAt: 3_000,
    });
  });

  it('flags the active side at zero and stops both clocks', () => {
    const started = startClock(createClock(1_000), 0);
    expect(advanceClock(started, 1_001)).toMatchObject({
      remainingMs: { w: 0, b: 1_000 }, active: null, running: false, flagged: 'w',
    });
  });

  it('pauses elapsed time and resumes from a new timestamp', () => {
    const started = startClock(createClock(10_000), 0);
    const paused = pauseClock(started, 2_500);
    expect(paused.remainingMs.w).toBe(7_500);
    const resumed = resumeClock(paused, 100_000);
    expect(advanceClock(resumed, 101_000).remainingMs.w).toBe(6_500);
  });

  it('never adds time when the monotonic timestamp moves backwards', () => {
    const started = startClock(createClock(10_000), 10_000);
    expect(advanceClock(started, 9_000).remainingMs.w).toBe(10_000);
  });

  it('rejects invalid starting time and increments', () => {
    expect(() => createClock(-1)).toThrow(RangeError);
    expect(() => createClock(1000, Number.NaN)).toThrow(RangeError);
  });
});
