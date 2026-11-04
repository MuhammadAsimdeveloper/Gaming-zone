import { describe, expect, it } from 'vitest';
import {
  BUS_CAPACITY,
  TRANSIT_DAYS,
  TRANSIT_TARGET,
  advanceTransitDay,
  assignBus,
  averageSatisfaction,
  buyTransitUpgrade,
  createTransitState,
  fare,
  recallBus,
  routeDemand,
  startTransit,
  totalBuses,
} from './simulation';

function running() {
  return startTransit(createTransitState());
}

describe('Rift Transit simulation', () => {
  it('starts with six buses across three routes and an empty reserve', () => {
    const state = createTransitState();
    expect(state.phase).toBe('ready');
    expect(totalBuses(state)).toBe(6);
    expect(state.reserve).toBe(0);
  });

  it('starts once and toggles the clock', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startTransit(state)).toBe(state);
  });

  it('assigns and recalls a reserve bus', () => {
    const state = running();
    expect(assignBus(state, 'harbor')).toBe(state);

    const withReserve = { ...state, reserve: 2 };
    const assigned = assignBus(withReserve, 'harbor');
    expect(assigned.routes.harbor.buses).toBe(3);
    expect(assigned.reserve).toBe(1);
    expect(recallBus(assigned, 'harbor').routes.harbor.buses).toBe(2);
  });

  it('buys upgrades and adds reserve buses with a fleet depot', () => {
    const state = { ...running(), credits: 500 };
    const bought = buyTransitUpgrade(state, 'fleet');
    expect(bought.fleetLevel).toBe(1);
    expect(bought.reserve).toBe(2);
    expect(bought.credits).toBe(390);
  });

  it('raises fares with fare tuning', () => {
    const state = { ...running(), credits: 500 };
    expect(fare(buyTransitUpgrade(state, 'fare'))).toBeGreaterThan(fare(state));
  });

  it('increases demand with marketing', () => {
    const state = { ...running(), credits: 500 };
    const base = routeDemand(state, 'orbit');
    expect(routeDemand(buyTransitUpgrade(state, 'marketing'), 'orbit')).toBeGreaterThan(base);
  });

  it('advances a day, records demand and pays operating costs', () => {
    const state = running();
    const next = advanceTransitDay(state);
    expect(next.day).toBe(2);
    expect(next.routes.harbor.demand).toBeGreaterThan(0);
    expect(next.routes.harbor.served).toBeLessThanOrEqual(
      next.routes.harbor.buses * BUS_CAPACITY,
    );
    expect(next.credits).not.toBe(state.credits);
    expect(next.totalServed).toBeGreaterThan(0);
  });

  it('reports average satisfaction between zero and one', () => {
    const next = advanceTransitDay(running());
    expect(averageSatisfaction(next)).toBeGreaterThan(0);
    expect(averageSatisfaction(next)).toBeLessThanOrEqual(1);
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= TRANSIT_DAYS; day += 1) state = advanceTransitDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(TRANSIT_DAYS);
    expect(TRANSIT_TARGET).toBeGreaterThan(0);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceTransitDay(paused)).toBe(paused);
  });
});
