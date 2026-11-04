import { describe, expect, it } from 'vitest';
import {
  SUPPLY_DAYS,
  SUPPLY_TARGET,
  adjustOutput,
  advanceSupplyDay,
  averageReliability,
  buyCapacity,
  createSupplyState,
  demandForecast,
  plantCapacity,
  startSupply,
  totalOutput,
} from './simulation';

function running() {
  return startSupply(createSupplyState());
}

describe('Grid Supply simulation', () => {
  it('starts ready with three plants and a balanced default dispatch', () => {
    const state = createSupplyState();
    expect(state.phase).toBe('ready');
    expect(totalOutput(state)).toBe(130);
    expect(plantCapacity(state, 'solar')).toBe(50);
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startSupply(state)).toBe(state);
  });

  it('adjusts output within plant capacity', () => {
    const state = running();
    expect(adjustOutput(state, 'solar', -10).output.solar).toBe(40);
    expect(adjustOutput(state, 'gas', -30).output.gas).toBe(0);
    expect(adjustOutput(state, 'solar', -100).output.solar).toBe(0);
  });

  it('expands capacity and increases the cap', () => {
    const state = { ...running(), credits: 500 };
    const bought = buyCapacity(state, 'wind');
    expect(bought.capacityLevel.wind).toBe(1);
    expect(plantCapacity(bought, 'wind')).toBe(75);
    expect(bought.credits).toBe(410);
  });

  it('produces a deterministic demand curve', () => {
    expect(demandForecast(4)).toBe(demandForecast(4));
    for (let day = 1; day <= SUPPLY_DAYS; day += 1) {
      expect(demandForecast(day)).toBeGreaterThan(0);
    }
  });

  it('advances a day, records reliability, and moves credits', () => {
    const state = running();
    const next = advanceSupplyDay(state);
    expect(next.day).toBe(2);
    expect(next.delivered).toBeGreaterThan(0);
    expect(next.reliability).toBeGreaterThan(0);
    expect(next.reliability).toBeLessThanOrEqual(1);
    expect(next.credits).not.toBe(state.credits);
  });

  it('penalises a blackout', () => {
    const state = { ...running(), output: { solar: 0, wind: 0, gas: 0 } };
    const next = advanceSupplyDay(state);
    expect(next.delivered).toBe(0);
    expect(next.credits).toBeLessThan(state.credits);
    expect(next.reliability).toBe(0);
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= SUPPLY_DAYS; day += 1) state = advanceSupplyDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(SUPPLY_DAYS);
    expect(SUPPLY_TARGET).toBeGreaterThan(0);
  });

  it('reports average reliability', () => {
    const next = advanceSupplyDay(running());
    expect(averageReliability(next)).toBeGreaterThan(0);
    expect(averageReliability(next)).toBeLessThanOrEqual(1);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceSupplyDay(paused)).toBe(paused);
  });
});
