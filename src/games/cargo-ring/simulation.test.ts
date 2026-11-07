import { describe, expect, it } from 'vitest';
import {
  CARGO_DAYS,
  CARGO_ROUTE_ORDER,
  CARGO_TARGET,
  TRUCK_CAPACITY,
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
  type CargoState,
} from './simulation';

function running() {
  return startCargo(createCargoState());
}

function playSeason(act: (state: CargoState) => CargoState): CargoState {
  let state = act(running());
  while (state.phase === 'running') state = advanceCargoDay(act(state));
  return state;
}

// Fuel first, then a bigger contract, then trucks only while the fleet is short.
function growTheDepot(upgrades: number) {
  return (state: CargoState): CargoState => {
    let next = state;
    for (let step = 0; step < upgrades; step += 1) {
      if (next.credits < 190) break;
      if (next.fuelLevel < 1) {
        next = upgradeFuel(next);
        continue;
      }
      if (next.contractLevel < 1) {
        next = upgradeContracts(next);
        continue;
      }
      const demand = CARGO_ROUTE_ORDER.reduce((sum, id) => sum + cargoDemand(next, id), 0);
      if (cargoTrucks(next) * TRUCK_CAPACITY < demand) next = buyTruck(next);
      else break;
    }

    while (next.reserve > 0) {
      const busiest = CARGO_ROUTE_ORDER.reduce((best, id) => {
        const gap = cargoDemand(next, id) - next.routes[id].trucks * TRUCK_CAPACITY;
        const bestGap = cargoDemand(next, best) - next.routes[best].trucks * TRUCK_CAPACITY;
        return gap > bestGap ? id : best;
      }, CARGO_ROUTE_ORDER[0]);
      next = assignTruck(next, busiest);
    }
    return next;
  };
}

describe('Cargo Ring simulation', () => {
  it('starts with six trucks across three lanes and no spares', () => {
    const state = createCargoState();
    expect(state.phase).toBe('ready');
    expect(cargoTrucks(state)).toBe(6);
    expect(state.reserve).toBe(0);
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

  it('rewards fuel, contracts and trucks over idling through the season', () => {
    const passive = playSeason((state) => state);
    const active = playSeason(growTheDepot(2));

    expect(passive.credits).toBeLessThan(CARGO_TARGET);
    expect(active.credits).toBeGreaterThanOrEqual(CARGO_TARGET);
  });
});
