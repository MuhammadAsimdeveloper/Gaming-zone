export const DINER_DAYS = 20;
export const DINER_TARGET = 900;

export type MenuItemId = 'burger' | 'noodles' | 'shake';
export type DinerPhase = 'ready' | 'running' | 'over';

export interface MenuItemSpec {
  id: MenuItemId;
  name: string;
  basePrice: number;
  cost: number;
  popularity: number;
  color: string;
}

export const MENU: Record<MenuItemId, MenuItemSpec> = {
  burger: { id: 'burger', name: 'Rift burger', basePrice: 12, cost: 4, popularity: 1, color: '#fbbf24' },
  noodles: { id: 'noodles', name: 'Neon noodles', basePrice: 9, cost: 3, popularity: 0.85, color: '#4ade9d' },
  shake: { id: 'shake', name: 'Plasma shake', basePrice: 6, cost: 2, popularity: 0.7, color: '#b285ff' },
};

export const MENU_ORDER: ReadonlyArray<MenuItemId> = ['burger', 'noodles', 'shake'];

export interface DinerState {
  day: number;
  credits: number;
  reputation: number;
  staff: number;
  tables: number;
  prices: Record<MenuItemId, number>;
  served: number;
  customers: number;
  revenue: number;
  phase: DinerPhase;
  paused: boolean;
  speed: 1 | 2;
  totalServed: number;
  seasonDays: number;
  log: string[];
}

export function createDinerState(): DinerState {
  return {
    day: 1,
    credits: 200,
    reputation: 70,
    staff: 2,
    tables: 4,
    prices: { burger: 12, noodles: 9, shake: 6 },
    served: 0,
    customers: 0,
    revenue: 0,
    phase: 'ready',
    paused: false,
    speed: 1,
    totalServed: 0,
    seasonDays: DINER_DAYS,
    log: ['Diner open. Set prices, then start the lunch service.'],
  };
}

export function averagePrice(state: DinerState): number {
  return MENU_ORDER.reduce((sum, id) => sum + state.prices[id], 0) / MENU_ORDER.length;
}

export function seatCapacity(state: DinerState): number {
  return state.tables * 4 + state.staff * 5;
}

export function adjustPrice(state: DinerState, id: MenuItemId, delta: number): DinerState {
  if (state.phase !== 'running') return state;
  const min = MENU[id].cost + 1;
  const next = Math.max(min, Math.min(25, state.prices[id] + delta));
  if (next === state.prices[id]) return state;
  return { ...state, prices: { ...state.prices, [id]: next } };
}

export function hireStaff(state: DinerState): DinerState {
  if (state.phase !== 'running' || state.staff >= 7 || state.credits < 80) return state;
  return {
    ...state,
    credits: state.credits - 80,
    staff: state.staff + 1,
    log: ['Hired another server.', ...state.log].slice(0, 4),
  };
}

export function addTables(state: DinerState): DinerState {
  if (state.phase !== 'running' || state.tables >= 14 || state.credits < 70) return state;
  return {
    ...state,
    credits: state.credits - 70,
    tables: state.tables + 2,
    log: ['Added two tables to the floor.', ...state.log].slice(0, 4),
  };
}

export function startDiner(state: DinerState): DinerState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Lunch service started.'] };
}

export function toggleDinerPause(state: DinerState): DinerState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleDinerSpeed(state: DinerState): DinerState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

const REFERENCE_PRICE =
  MENU_ORDER.reduce((sum, id) => sum + MENU[id].basePrice, 0) / MENU_ORDER.length;

/** Demand response to the menu price. Doubling the price cuts footfall several-fold. */
export function priceFactor(state: DinerState): number {
  const ratio = averagePrice(state) / REFERENCE_PRICE;
  return Math.max(0.05, Math.min(1.2, Math.pow(1 / ratio, 2.5)));
}

export function customerDemand(state: DinerState): number {
  const regulars = 22 + state.reputation * 0.35;
  return Math.max(5, Math.round(regulars * priceFactor(state)));
}

export function advanceDinerDay(state: DinerState): DinerState {
  if (state.phase !== 'running' || state.paused) return state;

  const customers = customerDemand(state);
  const capacity = seatCapacity(state);
  const served = Math.min(customers, capacity);
  const average = averagePrice(state);
  const revenue = Math.round(served * average);
  const ingredientCost = Math.round(served * 3);
  const payroll = state.staff * 28;
  const rent = 35;
  const profit = revenue - ingredientCost - payroll - rent;
  const service = customers > 0 ? served / customers : 1;
  const fairness = Math.max(0.3, priceFactor(state));
  const reputationTarget = service * 100 * fairness;
  const reputation = Math.max(
    0,
    Math.min(100, Math.round(state.reputation + (reputationTarget - state.reputation) * 0.2)),
  );
  const nextDay = state.day + 1;
  const finished = nextDay > state.seasonDays;
  const log = [...state.log];

  log.unshift(
    `Day ${state.day}: ${served}/${customers} covers · ${profit >= 0 ? '+' : ''}${profit} credits.`,
  );
  if (service < 0.75) log.unshift('The queue is backing up — add tables or staff.');
  if (finished) log.unshift(`Service closed with ${state.credits + profit} credits.`);

  return {
    ...state,
    day: finished ? state.seasonDays : nextDay,
    credits: state.credits + profit,
    reputation,
    served,
    customers,
    revenue,
    totalServed: state.totalServed + served,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}
