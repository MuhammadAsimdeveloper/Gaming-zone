export const TRANSIT_DAYS = 20;
export const TRANSIT_TARGET = 1200;
export const BUS_COST = 90;
export const BUS_CAPACITY = 18;

export type TransitRouteId = 'harbor' | 'midtown' | 'orbit';
export type TransitPhase = 'ready' | 'running' | 'over';
export type TransitUpgrade = 'fleet' | 'marketing' | 'fare';

export interface RouteSpec {
  id: TransitRouteId;
  name: string;
  baseDemand: number;
  color: string;
}

export const TRANSIT_ROUTES: Record<TransitRouteId, RouteSpec> = {
  harbor: { id: 'harbor', name: 'Harbor Loop', baseDemand: 35, color: '#4c8dff' },
  midtown: { id: 'midtown', name: 'Midtown Line', baseDemand: 55, color: '#4ade9d' },
  orbit: { id: 'orbit', name: 'Orbit Express', baseDemand: 70, color: '#b285ff' },
};

export const TRANSIT_ROUTE_ORDER: ReadonlyArray<TransitRouteId> = ['harbor', 'midtown', 'orbit'];

export interface RouteDay {
  buses: number;
  demand: number;
  served: number;
  satisfaction: number;
  revenue: number;
}

export interface TransitState {
  day: number;
  credits: number;
  reserve: number;
  routes: Record<TransitRouteId, RouteDay>;
  fleetLevel: number;
  marketingLevel: number;
  fareLevel: number;
  phase: TransitPhase;
  paused: boolean;
  speed: 1 | 2;
  totalServed: number;
  seasonDays: number;
  log: string[];
}

export interface TransitUpgradeSpec {
  id: TransitUpgrade;
  name: string;
  description: string;
  cost: number;
  max: number;
}

export const TRANSIT_UPGRADES: Record<TransitUpgrade, TransitUpgradeSpec> = {
  fleet: {
    id: 'fleet',
    name: 'Fleet depot',
    description: '+2 reserve buses and +4 seats per bus.',
    cost: 110,
    max: 3,
  },
  marketing: {
    id: 'marketing',
    name: 'Ridership campaign',
    description: '+15% demand on every route.',
    cost: 95,
    max: 3,
  },
  fare: {
    id: 'fare',
    name: 'Fare tuning',
    description: '+0.35 credits per passenger.',
    cost: 80,
    max: 3,
  },
};

export const TRANSIT_UPGRADE_ORDER: ReadonlyArray<TransitUpgrade> = ['fleet', 'marketing', 'fare'];

export function busCapacity(state: TransitState): number {
  return BUS_CAPACITY + state.fleetLevel * 4;
}

export function fare(state: TransitState): number {
  return 2.2 + state.fareLevel * 0.35;
}

export function demandMultiplier(state: TransitState): number {
  return 1 + state.marketingLevel * 0.15;
}

export function createTransitState(): TransitState {
  return {
    day: 1,
    credits: 250,
    reserve: 0,
    routes: {
      harbor: { buses: 2, demand: 0, served: 0, satisfaction: 1, revenue: 0 },
      midtown: { buses: 2, demand: 0, served: 0, satisfaction: 1, revenue: 0 },
      orbit: { buses: 2, demand: 0, served: 0, satisfaction: 1, revenue: 0 },
    },
    fleetLevel: 0,
    marketingLevel: 0,
    fareLevel: 0,
    phase: 'ready',
    paused: false,
    speed: 1,
    totalServed: 0,
    seasonDays: TRANSIT_DAYS,
    log: ['Dispatch ready. Two buses on each line; the reserve is empty.'],
  };
}

export function startTransit(state: TransitState): TransitState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Morning service started.'] };
}

export function toggleTransitPause(state: TransitState): TransitState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleTransitSpeed(state: TransitState): TransitState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function assignBus(state: TransitState, id: TransitRouteId): TransitState {
  if (state.phase !== 'running' || state.reserve <= 0) return state;
  return {
    ...state,
    reserve: state.reserve - 1,
    routes: { ...state.routes, [id]: { ...state.routes[id], buses: state.routes[id].buses + 1 } },
  };
}

export function recallBus(state: TransitState, id: TransitRouteId): TransitState {
  if (state.phase !== 'running' || state.routes[id].buses <= 0) return state;
  return {
    ...state,
    reserve: state.reserve + 1,
    routes: { ...state.routes, [id]: { ...state.routes[id], buses: state.routes[id].buses - 1 } },
  };
}

export function buyTransitUpgrade(state: TransitState, id: TransitUpgrade): TransitState {
  const spec = TRANSIT_UPGRADES[id];
  const level = id === 'fleet' ? state.fleetLevel : id === 'marketing' ? state.marketingLevel : state.fareLevel;
  if (state.phase !== 'running' || level >= spec.max || state.credits < spec.cost) return state;

  const next = {
    ...state,
    credits: state.credits - spec.cost,
    fleetLevel: state.fleetLevel + (id === 'fleet' ? 1 : 0),
    marketingLevel: state.marketingLevel + (id === 'marketing' ? 1 : 0),
    fareLevel: state.fareLevel + (id === 'fare' ? 1 : 0),
    reserve: state.reserve + (id === 'fleet' ? 2 : 0),
    log: [`${spec.name} upgraded to level ${level + 1}.`, ...state.log].slice(0, 4),
  };
  return next;
}

/** Deterministic daily demand, so every player sees the same rush-hour curve. */
export function routeDemand(state: TransitState, id: TransitRouteId): number {
  const spec = TRANSIT_ROUTES[id];
  const index = TRANSIT_ROUTE_ORDER.indexOf(id);
  const wave = 0.88 + Math.sin((state.day - 1) * 0.55 + index * 1.7) * 0.14;
  return Math.max(8, Math.round(spec.baseDemand * wave * demandMultiplier(state)));
}

export function advanceTransitDay(state: TransitState): TransitState {
  if (state.phase !== 'running' || state.paused) return state;

  const capacity = busCapacity(state);
  const price = fare(state);
  let totalRevenue = 0;
  let totalBuses = 0;
  let totalServed = 0;
  let totalDemand = 0;

  const routes = { ...state.routes };
  for (const id of TRANSIT_ROUTE_ORDER) {
    const current = routes[id];
    const demand = routeDemand(state, id);
    const served = Math.min(demand, current.buses * capacity);
    const revenue = Math.round(served * price);
    routes[id] = {
      ...current,
      demand,
      served,
      satisfaction: demand > 0 ? served / demand : 1,
      revenue,
    };
    totalRevenue += revenue;
    totalBuses += current.buses;
    totalServed += served;
    totalDemand += demand;
  }

  const operatingCost = 50 + totalBuses * 22;
  const profit = totalRevenue - operatingCost;
  const nextDay = state.day + 1;
  const finished = nextDay > state.seasonDays;
  const log = [...state.log];

  log.unshift(
    `Day ${state.day}: ${totalServed}/${totalDemand} passengers · ${profit >= 0 ? '+' : ''}${profit} credits.`,
  );
  if (totalDemand > 0 && totalServed / totalDemand < 0.6) {
    log.unshift('Ridership is being left behind — add buses or capacity.');
  }
  if (finished) log.unshift(`Season closed with ${state.credits + profit} credits.`);

  return {
    ...state,
    day: finished ? state.seasonDays : nextDay,
    credits: state.credits + profit,
    routes,
    totalServed: state.totalServed + totalServed,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}

export function averageSatisfaction(state: TransitState): number {
  const values = TRANSIT_ROUTE_ORDER.map((id) => state.routes[id].satisfaction);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function totalBuses(state: TransitState): number {
  return TRANSIT_ROUTE_ORDER.reduce((sum, id) => sum + state.routes[id].buses, 0);
}
