export const CARGO_DAYS = 20;
export const CARGO_TARGET = 2000;
export const TRUCK_CAPACITY = 12;

export type CargoRouteId = 'inner' | 'outer' | 'deep';
export type CargoPhase = 'ready' | 'running' | 'over';

export interface CargoRouteSpec {
  id: CargoRouteId;
  name: string;
  baseDemand: number;
  color: string;
}

export const CARGO_ROUTES: Record<CargoRouteId, CargoRouteSpec> = {
  inner: { id: 'inner', name: 'Inner Ring', baseDemand: 45, color: '#4ade9d' },
  outer: { id: 'outer', name: 'Outer Belt', baseDemand: 60, color: '#4c8dff' },
  deep: { id: 'deep', name: 'Deep Run', baseDemand: 80, color: '#b285ff' },
};

export const CARGO_ROUTE_ORDER: ReadonlyArray<CargoRouteId> = ['inner', 'outer', 'deep'];

export interface CargoRouteDay {
  trucks: number;
  demand: number;
  hauled: number;
  revenue: number;
}

export interface CargoState {
  day: number;
  credits: number;
  reserve: number;
  routes: Record<CargoRouteId, CargoRouteDay>;
  contractLevel: number;
  fuelLevel: number;
  phase: CargoPhase;
  paused: boolean;
  speed: 1 | 2;
  totalHauled: number;
  seasonDays: number;
  log: string[];
}

export function createCargoState(): CargoState {
  return {
    day: 1,
    credits: 300,
    reserve: 0,
    routes: {
      inner: { trucks: 2, demand: 0, hauled: 0, revenue: 0 },
      outer: { trucks: 2, demand: 0, hauled: 0, revenue: 0 },
      deep: { trucks: 2, demand: 0, hauled: 0, revenue: 0 },
    },
    contractLevel: 0,
    fuelLevel: 0,
    phase: 'ready',
    paused: false,
    speed: 1,
    totalHauled: 0,
    seasonDays: CARGO_DAYS,
    log: ['Depot ready. Two trucks assigned to each contract lane.'],
  };
}

export function cargoTrucks(state: CargoState): number {
  return CARGO_ROUTE_ORDER.reduce((sum, id) => sum + state.routes[id].trucks, 0);
}

export function cargoDemand(state: CargoState, id: CargoRouteId): number {
  const spec = CARGO_ROUTES[id];
  const index = CARGO_ROUTE_ORDER.indexOf(id);
  const wave = 0.9 + Math.sin((state.day - 1) * 0.48 + index * 1.4) * 0.16;
  return Math.max(8, Math.round(spec.baseDemand * wave * (1 + state.contractLevel * 0.12)));
}

export function assignTruck(state: CargoState, id: CargoRouteId): CargoState {
  if (state.phase !== 'running' || state.reserve <= 0) return state;
  return {
    ...state,
    reserve: state.reserve - 1,
    routes: { ...state.routes, [id]: { ...state.routes[id], trucks: state.routes[id].trucks + 1 } },
  };
}

export function recallTruck(state: CargoState, id: CargoRouteId): CargoState {
  if (state.phase !== 'running' || state.routes[id].trucks <= 0) return state;
  return {
    ...state,
    reserve: state.reserve + 1,
    routes: { ...state.routes, [id]: { ...state.routes[id], trucks: state.routes[id].trucks - 1 } },
  };
}

export function buyTruck(state: CargoState): CargoState {
  if (state.phase !== 'running' || state.credits < 110) return state;
  return { ...state, credits: state.credits - 110, reserve: state.reserve + 1, log: ['Bought a depot truck.', ...state.log].slice(0, 4) };
}

export function upgradeContracts(state: CargoState): CargoState {
  if (state.phase !== 'running' || state.contractLevel >= 3 || state.credits < 95) return state;
  return { ...state, credits: state.credits - 95, contractLevel: state.contractLevel + 1, log: ['Signed a bigger contract.', ...state.log].slice(0, 4) };
}

export function upgradeFuel(state: CargoState): CargoState {
  if (state.phase !== 'running' || state.fuelLevel >= 3 || state.credits < 85) return state;
  return { ...state, credits: state.credits - 85, fuelLevel: state.fuelLevel + 1, log: ['Fuel efficiency improved.', ...state.log].slice(0, 4) };
}

export function startCargo(state: CargoState): CargoState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Depot opened. Trucks rolling.'] };
}

export function toggleCargoPause(state: CargoState): CargoState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleCargoSpeed(state: CargoState): CargoState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function advanceCargoDay(state: CargoState): CargoState {
  if (state.phase !== 'running' || state.paused) return state;

  let revenue = 0;
  let hauled = 0;
  let demand = 0;
  const routes = { ...state.routes };
  for (const id of CARGO_ROUTE_ORDER) {
    const current = routes[id];
    const routeDemandValue = cargoDemand(state, id);
    const routeHauled = Math.min(routeDemandValue, current.trucks * TRUCK_CAPACITY);
    const routeRevenue = Math.round(routeHauled * (7 + state.fuelLevel * 0.4));
    routes[id] = { ...current, demand: routeDemandValue, hauled: routeHauled, revenue: routeRevenue };
    revenue += routeRevenue;
    hauled += routeHauled;
    demand += routeDemandValue;
  }

  const cost = 40 + cargoTrucks(state) * 22;
  const profit = revenue - cost;
  const nextDay = state.day + 1;
  const finished = nextDay > state.seasonDays;
  const log = [...state.log];

  log.unshift(
    `Day ${state.day}: ${hauled}/${demand} crates · ${profit >= 0 ? '+' : ''}${profit} credits.`,
  );
  if (hauled < demand) log.unshift('Contracts are outpacing the fleet.');
  if (finished) log.unshift(`Depot closed with ${state.credits + profit} credits.`);

  return {
    ...state,
    day: finished ? state.seasonDays : nextDay,
    credits: state.credits + profit,
    routes,
    totalHauled: state.totalHauled + hauled,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}
