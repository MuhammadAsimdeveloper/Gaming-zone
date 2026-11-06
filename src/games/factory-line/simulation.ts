export const FACTORY_DAYS = 20;
export const FACTORY_TARGET = 1500;

export type FactoryPhase = 'ready' | 'running' | 'over';

export interface FactoryState {
  day: number;
  credits: number;
  machines: number;
  workers: number;
  automation: number;
  orders: number;
  produced: number;
  phase: FactoryPhase;
  paused: boolean;
  speed: 1 | 2;
  totalProduced: number;
  seasonDays: number;
  log: string[];
}

export function createFactoryState(): FactoryState {
  return {
    day: 1,
    credits: 300,
    machines: 3,
    workers: 4,
    automation: 0,
    orders: 0,
    produced: 0,
    phase: 'ready',
    paused: false,
    speed: 1,
    totalProduced: 0,
    seasonDays: FACTORY_DAYS,
    log: ['Line ready. Three machines and four operators on shift.'],
  };
}

export function factoryOutput(state: FactoryState): number {
  return Math.round((state.machines * 8 + state.workers * 4) * (1 + state.automation * 0.1));
}

export function orderDemand(day: number): number {
  return Math.max(8, Math.round(30 + Math.sin((day - 1) * 0.55) * 6 + day * 0.55));
}

export function buyMachine(state: FactoryState): FactoryState {
  if (state.phase !== 'running' || state.machines >= 9 || state.credits < 120) return state;
  return {
    ...state,
    credits: state.credits - 120,
    machines: state.machines + 1,
    log: ['Installed another machine.', ...state.log].slice(0, 4),
  };
}

export function hireOperator(state: FactoryState): FactoryState {
  if (state.phase !== 'running' || state.workers >= 14 || state.credits < 45) return state;
  return {
    ...state,
    credits: state.credits - 45,
    workers: state.workers + 1,
    log: ['Hired another line operator.', ...state.log].slice(0, 4),
  };
}

export function installAutomation(state: FactoryState): FactoryState {
  if (state.phase !== 'running' || state.automation >= 3 || state.credits < 110) return state;
  return {
    ...state,
    credits: state.credits - 110,
    automation: state.automation + 1,
    log: ['Automation tier installed — output efficiency up.', ...state.log].slice(0, 4),
  };
}

export function startFactory(state: FactoryState): FactoryState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Line started. First order wave inbound.'] };
}

export function toggleFactoryPause(state: FactoryState): FactoryState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleFactorySpeed(state: FactoryState): FactoryState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function advanceFactoryDay(state: FactoryState): FactoryState {
  if (state.phase !== 'running' || state.paused) return state;

  const orders = orderDemand(state.day);
  const capacity = factoryOutput(state);
  const produced = Math.min(orders, capacity);
  const backlog = orders - produced;
  const revenue = produced * 10;
  const costs = state.machines * 25 + state.workers * 18 + 30;
  const penalty = backlog * 4;
  const profit = revenue - costs - penalty;
  const nextDay = state.day + 1;
  const insolvent = state.credits + profit < 0;
  const finished = nextDay > state.seasonDays || insolvent;
  const log = [...state.log];

  log.unshift(
    `Day ${state.day}: ${produced}/${orders} units · ${profit >= 0 ? '+' : ''}${profit} credits.`,
  );
  if (backlog > 0) log.unshift(`${backlog} orders went to backlog.`);
  if (insolvent) log.unshift('Insolvent: creditors closed the line.');
  else if (finished) log.unshift(`Line closed with ${state.credits + profit} credits.`);

  return {
    ...state,
    day: finished ? state.day : nextDay,
    credits: state.credits + profit,
    orders,
    produced,
    totalProduced: state.totalProduced + produced,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}
