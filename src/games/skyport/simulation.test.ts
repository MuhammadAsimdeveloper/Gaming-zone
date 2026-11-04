import { describe, expect, it } from 'vitest';
import {
  SKYPORT_DAYS,
  SKYPORT_TARGET,
  advanceSkyportDay,
  createSkyportState,
  flightDemand,
  hireCrew,
  openGate,
  openRunway,
  slotCapacity,
  startSkyport,
} from './simulation';

function running() {
  return startSkyport(createSkyportState());
}

describe('Skyport simulation', () => {
  it('starts ready with two gates, one runway and four crew', () => {
    const state = createSkyportState();
    expect(state.phase).toBe('ready');
    expect(slotCapacity(state)).toBe(6);
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startSkyport(state)).toBe(state);
  });

  it('opens gates and runways for credits', () => {
    const state = { ...running(), credits: 500 };
    const gate = openGate(state);
    expect(gate.gates).toBe(3);
    expect(gate.credits).toBe(400);
    const runway = openRunway(gate);
    expect(runway.runways).toBe(2);
    expect(runway.credits).toBe(240);
  });

  it('hires crew and increases slot capacity', () => {
    const state = { ...running(), credits: 500, staff: 1 };
    expect(slotCapacity(state)).toBe(3);
    const hired = hireCrew(state);
    expect(hired.staff).toBe(2);
    expect(hired.credits).toBe(455);
  });

  it('computes deterministic flight demand', () => {
    expect(flightDemand(3)).toBe(flightDemand(3));
    for (let day = 1; day <= SKYPORT_DAYS; day += 1) {
      expect(flightDemand(day)).toBeGreaterThan(0);
    }
  });

  it('advances a day and handles at most the slot capacity', () => {
    const state = running();
    const next = advanceSkyportDay(state);
    expect(next.day).toBe(2);
    expect(next.handled).toBeLessThanOrEqual(slotCapacity(state));
    expect(next.totalHandled).toBe(next.handled);
    expect(next.credits).not.toBe(state.credits);
  });

  it('records diverted flights when capacity is short', () => {
    const state = running();
    const next = advanceSkyportDay(state);
    expect(next.missed).toBe(Math.max(0, next.flights - slotCapacity(state)));
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= SKYPORT_DAYS; day += 1) state = advanceSkyportDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(SKYPORT_DAYS);
    expect(SKYPORT_TARGET).toBeGreaterThan(0);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceSkyportDay(paused)).toBe(paused);
  });
});
