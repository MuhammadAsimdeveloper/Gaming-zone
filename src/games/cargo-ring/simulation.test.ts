import { describe, expect, it } from 'vitest';
import {
  CARGO_DAYS,
  CARGO_TARGET,
  assignTruck,
  advanceCargoDay,
  buyTruck,
  cargoDemand,
  cargoTrucks,
  createCargoState,
  recallTruck,
  startCargo,
  upgradeContracts,
  upgradeFuel,
} from './simulation';

function running() {
  return startCargo(createCargoState());
}

describe('Cargo Ring simulation', () => {
  it('starts with six trucks across three lanes', () => {
    const state = createCargoState();
    expect(state.phase).toBe('ready');
    expect(cargoTrucks(state)).toBe(6);
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startCargo(state)).toBe(state);
  });

  it('assigns and recalls reserve trucks', () => {
    const state = { ...running(), reserve: 2 };
    const assigned = assignTruck(state, 'outer');
    expect(assigned.routes.outer.trucks).toBe(3);
    expect(assigned.reserve).toBe(1);
    expect(recallTruck(assigned, 'outer').routes.outer.trucks).toBe(2);
  });

  it('buys trucks and upgrades contracts and fuel', () => {
    const state = { ...running(), credits: 500 };
    const truck = buyTruck(state);
    expect(truck.reserve).toBe(1);
    expect(truck.credits).toBe(390);
    const contract = upgradeContracts(truck);
    expect(contract.contractLevel).toBe(1);
    expect(contract.credits).toBe(295);
    const fuel = upgradeFuel(contract);
    expect(fuel.fuelLevel).toBe(1);
    expect(fuel.credits).toBe(210);
  });

  it('raises demand with bigger contracts', () => {
    const state = { ...running(), credits: 500 };
    expect(cargoDemand(upgradeContracts(state), 'deep')).toBeGreaterThan(cargoDemand(state, 'deep'));
  });

  it('advances a day and hauls within truck capacity', () => {
    const state = running();
    const next = advanceCargoDay(state);
    expect(next.day).toBe(2);
    expect(next.routes.inner.hauled).toBeLessThanOrEqual(state.routes.inner.trucks * 12);
    expect(next.totalHauled).toBeGreaterThan(0);
    expect(next.credits).not.toBe(state.credits);
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= CARGO_DAYS; day += 1) state = advanceCargoDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(CARGO_DAYS);
    expect(CARGO_TARGET).toBeGreaterThan(0);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceCargoDay(paused)).toBe(paused);
  });
});
