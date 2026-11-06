export const AQUA_DAYS = 20;
export const AQUA_TARGET = 1200;

export type AquaPhase = 'ready' | 'running' | 'over';

export interface AquaState {
  day: number;
  credits: number;
  reservoir: number;
  pumps: number;
  condition: number;
  demand: number;
  delivered: number;
  phase: AquaPhase;
  paused: boolean;
  speed: 1 | 2;
  totalDelivered: number;
  seasonDays: number;
  log: string[];
}

export function createAquaState(): AquaState {
  return {
    day: 1,
    credits: 300,
    reservoir: 60,
    pumps: 2,
    condition: 80,
    demand: 0,
    delivered: 0,
    phase: 'ready',
    paused: false,
    speed: 1,
    totalDelivered: 0,
    seasonDays: AQUA_DAYS,
    log: ['Water grid ready. Two pumps and a reservoir at 60 units.'],
  };
}

export function waterDemand(day: number): number {
  return Math.max(20, Math.round(42 + Math.sin((day - 1) * 0.5) * 8 + day * 0.45));
}

export function leakRate(state: AquaState): number {
  return Math.round((100 - state.condition) * 0.35);
}

export function buildPump(state: AquaState): AquaState {
  if (state.phase !== 'running' || state.pumps >= 6 || state.credits < 120) return state;
  return { ...state, credits: state.credits - 120, pumps: state.pumps + 1, log: ['Installed a new pump.', ...state.log].slice(0, 4) };
}

export function repairPipes(state: AquaState): AquaState {
  if (state.phase !== 'running' || state.condition >= 100 || state.credits < 70) return state;
  return {
    ...state,
    credits: state.credits - 70,
    condition: Math.min(100, state.condition + 20),
    log: ['Pipe network repaired.', ...state.log].slice(0, 4),
  };
}

export function startAqua(state: AquaState): AquaState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Water grid online. Watch the reservoir.'] };
}

export function toggleAquaPause(state: AquaState): AquaState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleAquaSpeed(state: AquaState): AquaState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function advanceAquaDay(state: AquaState): AquaState {
  if (state.phase !== 'running' || state.paused) return state;

  const demand = waterDemand(state.day);
  const inflow = state.pumps * 16;
  const leak = leakRate(state);
  const available = Math.max(0, state.reservoir + inflow - leak);
  const delivered = Math.min(demand, available);
  const shortfall = demand - delivered;
  const revenue = delivered * 4;
  const costs = state.pumps * 22 + 20;
  const penalty = shortfall * 18;
  const profit = revenue - costs - penalty;
  const reservoir = Math.max(0, available - delivered);
  const condition = Math.max(0, state.condition - 1);
  const nextDay = state.day + 1;
  const insolvent = state.credits + profit < 0;
  const finished = nextDay > state.seasonDays || insolvent;
  const log = [...state.log];

  log.unshift(
    `Day ${state.day}: ${delivered}/${demand} units · ${profit >= 0 ? '+' : ''}${profit} credits.`,
  );
  if (shortfall > 0) log.unshift(`Shortfall: ${shortfall} units could not be delivered.`);
  if (leak > 12) log.unshift(`Pipes are leaking ${leak} units per day.`);
  if (insolvent) log.unshift('Insolvent: creditors closed the grid.');
  else if (finished) log.unshift(`Grid closed with ${state.credits + profit} credits.`);

  return {
    ...state,
    day: finished ? state.day : nextDay,
    credits: state.credits + profit,
    reservoir,
    condition,
    demand,
    delivered,
    totalDelivered: state.totalDelivered + delivered,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}
