import { describe, expect, it } from 'vitest';
import {
  OFF_TRACK_LIMIT,
  advanceRun,
  beginRun,
  createRun,
  formatSplitDelta,
  medalForTime,
  registerGate,
  registerOffTrack,
  respawnRun,
  sectorCount,
  splitsRemaining,
  type MedalThresholds,
  type RunState,
  type TrialRulesConfig,
} from './rules';

const CONFIG: TrialRulesConfig = { totalLaps: 2, checkpointsPerLap: 2 };

function runningRun(clock = 0) {
  const started = beginRun(createRun());
  return clock > 0 ? advanceRun(started, clock) : started;
}

describe('time trial run rules', () => {
  it('starts ready and only clocks time once the run begins', () => {
    const ready = createRun();
    expect(ready.status).toBe('ready');
    expect(ready.clock).toBe(0);
    expect(ready.lap).toBe(1);
    expect(ready.nextGate).toBe(1);
    expect(advanceRun(ready, 2).clock).toBe(0);

    const running = beginRun(ready);
    expect(running.status).toBe('running');
    expect(advanceRun(running, 0.5).clock).toBeCloseTo(0.5);
  });

  it('records checkpoint splits in order', () => {
    let run = runningRun();
    run = advanceRun(run, 10);
    run = registerGate(run, 1, CONFIG);
    expect(run.splits).toEqual([10]);
    expect(run.nextGate).toBe(2);
    expect(run.status).toBe('running');

    run = advanceRun(run, 5);
    run = registerGate(run, 2, CONFIG);
    expect(run.splits).toEqual([10, 15]);
    expect(run.nextGate).toBe(3);
  });

  it('invalidates a run that skips a checkpoint', () => {
    let run = advanceRun(runningRun(), 4);
    run = registerGate(run, 2, CONFIG);
    expect(run.status).toBe('invalid');
    expect(run.invalidReason).toBe('Missed checkpoint 1');
    expect(run.splits).toEqual([]);
  });

  it('ignores gates that were already passed', () => {
    let run = runningRun();
    run = registerGate(run, 1, CONFIG);
    run = registerGate(run, 1, CONFIG);
    expect(run.splits).toHaveLength(1);
    expect(run.status).toBe('running');
  });

  it('ignores the finish line until every checkpoint is collected', () => {
    let run = runningRun();
    run = advanceRun(run, 3);
    run = registerGate(run, 0, CONFIG);
    expect(run.status).toBe('running');
    expect(run.splits).toEqual([]);
    expect(run.lap).toBe(1);
  });

  it('completes a lap and resets the checkpoint sequence', () => {
    let run = runningRun();
    run = advanceRun(run, 8);
    run = registerGate(run, 1, CONFIG);
    run = advanceRun(run, 7);
    run = registerGate(run, 2, CONFIG);
    run = advanceRun(run, 9);
    run = registerGate(run, 0, CONFIG);
    expect(run.lap).toBe(2);
    expect(run.nextGate).toBe(1);
    expect(run.splits).toEqual([8, 15, 24]);
    expect(run.status).toBe('running');
  });

  it('finishes after the final lap and stops the clock', () => {
    let run = runningRun();
    for (let lap = 0; lap < 2; lap += 1) {
      run = advanceRun(run, 5);
      run = registerGate(run, 1, CONFIG);
      run = advanceRun(run, 5);
      run = registerGate(run, 2, CONFIG);
      run = advanceRun(run, 5);
      run = registerGate(run, 0, CONFIG);
    }
    expect(run.status).toBe('finished');
    expect(run.splits).toEqual([5, 10, 15, 20, 25, 30]);
    expect(run.splits.at(-1)).toBe(30);
    expect(advanceRun(run, 5).clock).toBe(30);
  });

  it('counts sectors and remaining splits', () => {
    expect(sectorCount(CONFIG)).toBe(6);
    let run = runningRun();
    expect(splitsRemaining(run, CONFIG)).toBe(6);
    run = registerGate(run, 1, CONFIG);
    expect(splitsRemaining(run, CONFIG)).toBe(5);
    run = registerGate(run, 2, CONFIG);
    run = registerGate(run, 0, CONFIG);
    expect(splitsRemaining(run, CONFIG)).toBe(3);
  });

  it('invalidates a run after too long off the track and resets the timer when back on', () => {
    let run = runningRun();
    run = registerOffTrack(run, true, OFF_TRACK_LIMIT * 0.5);
    expect(run.status).toBe('running');
    run = registerOffTrack(run, false, 0.1);
    expect(run.offTrackTime).toBe(0);

    run = registerOffTrack(run, true, OFF_TRACK_LIMIT);
    expect(run.status).toBe('running');
    run = registerOffTrack(run, true, 0.01);
    expect(run.status).toBe('invalid');
    expect(run.invalidReason).toBe('Off track for too long');
  });

  it('counts respawns without stopping the clock', () => {
    let run = runningRun(12);
    run = advanceRun(run, 1);
    run = respawnRun(run);
    expect(run.respawns).toBe(1);
    expect(run.clock).toBe(13);
    expect(run.status).toBe('running');

    const finished = { ...run, status: 'finished' as const };
    expect(respawnRun(finished).respawns).toBe(1);
  });

  it('ignores gates and the clock once a run is invalid', () => {
    let run: RunState = { ...runningRun(4), status: 'invalid' as const, invalidReason: 'test' };
    run = registerGate(run, 1, CONFIG);
    expect(run.splits).toEqual([]);
    expect(advanceRun(run, 1).clock).toBe(4);
  });

  it('awards the best medal whose threshold is met', () => {
    const thresholds: MedalThresholds = { author: 30, gold: 34, silver: 40, bronze: 50 };
    expect(medalForTime(thresholds, 29.99)).toBe('author');
    expect(medalForTime(thresholds, 30)).toBe('author');
    expect(medalForTime(thresholds, 30.01)).toBe('gold');
    expect(medalForTime(thresholds, 40)).toBe('silver');
    expect(medalForTime(thresholds, 50)).toBe('bronze');
    expect(medalForTime(thresholds, 50.01)).toBe('none');
    expect(medalForTime(thresholds, Number.NaN)).toBe('none');
  });

  it('formats split deltas with a sign', () => {
    expect(formatSplitDelta(0)).toBe('±0.00');
    expect(formatSplitDelta(1.234)).toBe('+1.23');
    expect(formatSplitDelta(-0.456)).toBe('−0.46');
    expect(formatSplitDelta(Number.NaN)).toBe('±0.00');
  });
});
