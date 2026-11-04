export const SUPPLY_DAYS = 20;
export const SUPPLY_TARGET = 700;

export type PlantId = 'solar' | 'wind' | 'gas';
export type SupplyPhase = 'ready' | 'running' | 'over';

export interface PlantSpec {
  id: PlantId;
  name: string;
  capacity: number;
  costPerUnit: number;
  color: string;
}

export const PLANTS: Record<PlantId, PlantSpec> = {
  solar: { id: 'solar', name: 'Solar array', capacity: 50, costPerUnit: 2, color: '#fbbf24' },
  wind: { id: 'wind', name: 'Wind ridge', capacity: 60, costPerUnit: 3, color: '#4c8dff' },
  gas: { id: 'gas', name: 'Gas peaker', capacity: 80, costPerUnit: 6.5, color: '#ff6b81' },
};

export const PLANT_ORDER: ReadonlyArray<PlantId> = ['solar', 'wind', 'gas'];

export interface SupplyState {
  day: number;
  credits: number;
  output: Record<PlantId, number>;
  capacityLevel: Record<PlantId, number>;
  demand: number;
  delivered: number;
  reliability: number;
  totalDelivered: number;
  totalDemand: number;
  phase: SupplyPhase;
  paused: boolean;
  speed: 1 | 2;
  seasonDays: number;
  log: string[];
}

export function plantCapacity(state: SupplyState, id: PlantId): number {
  return PLANTS[id].capacity + state.capacityLevel[id] * 15;
}

export function totalOutput(state: SupplyState): number {
  return PLANT_ORDER.reduce((sum, id) => sum + state.output[id], 0);
}

export function createSupplyState(): SupplyState {
  return {
    day: 1,
    credits: 200,
    output: { solar: 50, wind: 60, gas: 20 },
    capacityLevel: { solar: 0, wind: 0, gas: 0 },
    demand: 0,
    delivered: 0,
    reliability: 1,
    totalDelivered: 0,
    totalDemand: 0,
    phase: 'ready',
    paused: false,
    speed: 1,
    seasonDays: SUPPLY_DAYS,
    log: ['Grid ready. Match generation to the morning demand curve.'],
  };
}

export function startSupply(state: SupplyState): SupplyState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Grid online. Watch the forecast.'] };
}

export function toggleSupplyPause(state: SupplyState): SupplyState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleSupplySpeed(state: SupplyState): SupplyState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function adjustOutput(state: SupplyState, id: PlantId, delta: number): SupplyState {
  if (state.phase !== 'running') return state;
  const next = Math.max(0, Math.min(plantCapacity(state, id), state.output[id] + delta));
  if (next === state.output[id]) return state;
  return { ...state, output: { ...state.output, [id]: next } };
}

export function buyCapacity(state: SupplyState, id: PlantId): SupplyState {
  const cost = 90 + state.capacityLevel[id] * 35;
  if (state.phase !== 'running' || state.capacityLevel[id] >= 3 || state.credits < cost) return state;

  return {
    ...state,
    credits: state.credits - cost,
    capacityLevel: { ...state.capacityLevel, [id]: state.capacityLevel[id] + 1 },
    log: [`${PLANTS[id].name} capacity expanded.`, ...state.log].slice(0, 4),
  };
}

/** Deterministic daily demand curve in MW. */
export function demandForecast(day: number): number {
  const base = 112;
  const morning = Math.sin((day - 1) * 0.62) * 22;
  const evening = Math.sin((day - 1) * 0.19 + 1.2) * 14;
  return Math.max(70, Math.round(base + morning + evening));
}

export function advanceSupplyDay(state: SupplyState): SupplyState {
  if (state.phase !== 'running' || state.paused) return state;

  const demand = demandForecast(state.day);
  const supply = totalOutput(state);
  const delivered = Math.min(demand, supply);
  const shortfall = Math.max(0, demand - supply);
  const revenue = Math.round(delivered * 3.5);
  const generationCost = Math.round(
    PLANT_ORDER.reduce((sum, id) => sum + state.output[id] * PLANTS[id].costPerUnit, 0),
  );
  const penalty = shortfall * 20;
  const profit = revenue - generationCost - penalty;
  const reliability = demand > 0 ? delivered / demand : 1;
  const nextDay = state.day + 1;
  const finished = nextDay > state.seasonDays;
  const log = [...state.log];

  log.unshift(
    `Day ${state.day}: ${delivered}/${demand} MW · ${profit >= 0 ? '+' : ''}${profit} credits.`,
  );
  if (shortfall > 0) log.unshift(`Blackout: ${shortfall} MW short. Penalty ${penalty} credits.`);
  if (finished) log.unshift(`Season closed with ${state.credits + profit} credits.`);

  return {
    ...state,
    day: finished ? state.seasonDays : nextDay,
    credits: state.credits + profit,
    demand,
    delivered,
    reliability,
    totalDelivered: state.totalDelivered + delivered,
    totalDemand: state.totalDemand + demand,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}

export function averageReliability(state: SupplyState): number {
  return state.totalDemand > 0 ? state.totalDelivered / state.totalDemand : 1;
}
