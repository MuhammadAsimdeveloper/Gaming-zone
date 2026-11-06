import { describe, expect, it } from 'vitest';
import {
  AQUA_DAYS,
  AQUA_TARGET,
  advanceAquaDay,
  buildPump,
  createAquaState,
  leakRate,
  repairPipes,
  startAqua,
  waterDemand,
} from './simulation';

function running() {
  return startAqua(createAquaState());
}

describe('Aqua Grid simulation', () => {
  it('starts ready with a reservoir, two pumps and pipe condition', () => {
    const state = createAquaState();
    expect(state.phase).toBe('ready');
    expect(state.reservoir).toBe(60);
    expect(state.pumps).toBe(2);
    expect(state.condition).toBe(80);
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startAqua(state)).toBe(state);
  });

  it('installs pumps and repairs pipes for credits', () => {
    const state = { ...running(), credits: 500, condition: 50 };
    const pumped = buildPump(state);
    expect(pumped.pumps).toBe(3);
    expect(pumped.credits).toBe(380);
    const repaired = repairPipes(pumped);
    expect(repaired.condition).toBe(70);
    expect(repaired.credits).toBe(310);
  });

  it('raises leak rate as condition falls', () => {
    const state = running();
    expect(leakRate({ ...state, condition: 20 })).toBeGreaterThan(leakRate(state));
  });

  it('computes deterministic demand', () => {
    expect(waterDemand(4)).toBe(waterDemand(4));
    for (let day = 1; day <= AQUA_DAYS; day += 1) expect(waterDemand(day)).toBeGreaterThan(0);
  });

  it('delivers water and updates the reservoir', () => {
    const state = running();
    const next = advanceAquaDay(state);
    expect(next.day).toBe(2);
    expect(next.delivered).toBeGreaterThan(0);
    expect(next.delivered).toBeLessThanOrEqual(waterDemand(state.day));
    expect(next.credits).not.toBe(state.credits);
  });

  it('penalises a shortfall when the reservoir cannot meet demand', () => {
    const state = { ...running(), reservoir: 0, pumps: 0, condition: 0 };
    const next = advanceAquaDay(state);
    expect(next.delivered).toBe(0);
    expect(next.credits).toBeLessThan(state.credits);
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= AQUA_DAYS; day += 1) {
      state = advanceAquaDay(state);
      if (state.phase === 'running') state = buildPump(state);
    }

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(AQUA_DAYS);
    expect(AQUA_TARGET).toBeGreaterThan(0);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceAquaDay(paused)).toBe(paused);
  });

  it('closes early when the grid cannot pay its bills', () => {
    const strained = { ...running(), credits: 10, pumps: 1, condition: 0, reservoir: 0 };

    const next = advanceAquaDay(strained);

    expect(next.credits).toBeLessThan(0);
    expect(next.phase).toBe('over');
    expect(next.log.some((entry) => /insolvent/i.test(entry))).toBe(true);
  });
});
