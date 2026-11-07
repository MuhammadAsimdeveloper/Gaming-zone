export const PARK_DAYS = 20;
export const PARK_TARGET = 45000;

export type ParkPhase = 'ready' | 'running' | 'over';

export interface ParkState {
  day: number;
  credits: number;
  reputation: number;
  ticket: number;
  rides: number;
  staff: number;
  marketing: number;
  visitors: number;
  served: number;
  revenue: number;
  phase: ParkPhase;
  paused: boolean;
  speed: 1 | 2;
  totalVisitors: number;
  seasonDays: number;
  log: string[];
}

export function createParkState(): ParkState {
  return {
    day: 1,
    credits: 300,
    reputation: 70,
    ticket: 22,
    rides: 4,
    staff: 5,
    marketing: 0,
    visitors: 0,
    served: 0,
    revenue: 0,
    phase: 'ready',
    paused: false,
    speed: 1,
    totalVisitors: 0,
    seasonDays: PARK_DAYS,
    log: ['Park ready. Four rides and five staff on the midway.'],
  };
}

export function parkCapacity(state: ParkState): number {
  return state.rides * 32 + state.staff * 6;
}

export function ticketFactor(state: ParkState): number {
  return Math.max(0.35, Math.min(1.3, 1.25 - (state.ticket / 40) * 0.55));
}

export function parkDemand(state: ParkState): number {
  const base = 42 + state.reputation * 0.28 + state.marketing * 18;
  return Math.max(6, Math.round(base * ticketFactor(state)));
}

export function adjustTicket(state: ParkState, delta: number): ParkState {
  if (state.phase !== 'running') return state;
  const next = Math.max(8, Math.min(45, state.ticket + delta));
  if (next === state.ticket) return state;
  return { ...state, ticket: next };
}

export function buildRide(state: ParkState): ParkState {
  if (state.phase !== 'running' || state.rides >= 10 || state.credits < 140) return state;
  return {
    ...state,
    credits: state.credits - 140,
    rides: state.rides + 1,
    log: ['A new ride opened on the midway.', ...state.log].slice(0, 4),
  };
}

export function hireParkStaff(state: ParkState): ParkState {
  if (state.phase !== 'running' || state.staff >= 16 || state.credits < 50) return state;
  return {
    ...state,
    credits: state.credits - 50,
    staff: state.staff + 1,
    log: ['Hired another park attendant.', ...state.log].slice(0, 4),
  };
}

export function runCampaign(state: ParkState): ParkState {
  if (state.phase !== 'running' || state.marketing >= 3 || state.credits < 90) return state;
  return {
    ...state,
    credits: state.credits - 90,
    marketing: state.marketing + 1,
    log: ['A new campaign is pulling in visitors.', ...state.log].slice(0, 4),
  };
}

export function startPark(state: ParkState): ParkState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Gates open. The first visitors are through.'] };
}

export function toggleParkPause(state: ParkState): ParkState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleParkSpeed(state: ParkState): ParkState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function advanceParkDay(state: ParkState): ParkState {
  if (state.phase !== 'running' || state.paused) return state;

  const visitors = parkDemand(state);
  const capacity = parkCapacity(state);
  const served = Math.min(visitors, capacity);
  const revenue = Math.round(served * (state.ticket + 6));
  const costs = state.rides * 55 + state.staff * 22 + 40;
  const profit = revenue - costs;
  const service = visitors > 0 ? served / visitors : 1;
  const reputation = Math.max(
    0,
    Math.min(100, Math.round(state.reputation + (service * 100 - state.reputation) * 0.18)),
  );
  const nextDay = state.day + 1;
  const finished = nextDay > state.seasonDays;
  const log = [...state.log];

  log.unshift(
    `Day ${state.day}: ${served}/${visitors} visitors · ${profit >= 0 ? '+' : ''}${profit} credits.`,
  );
  if (service < 0.8) log.unshift('Queues are long — add ride capacity or staff.');
  if (finished) log.unshift(`Park closed with ${state.credits + profit} credits.`);

  return {
    ...state,
    day: finished ? state.seasonDays : nextDay,
    credits: state.credits + profit,
    reputation,
    visitors,
    served,
    revenue,
    totalVisitors: state.totalVisitors + served,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}
