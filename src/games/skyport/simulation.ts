export const SKYPORT_DAYS = 20;
export const SKYPORT_TARGET = 1000;

export type SkyportPhase = 'ready' | 'running' | 'over';

export interface SkyportState {
  day: number;
  credits: number;
  gates: number;
  runways: number;
  staff: number;
  flights: number;
  handled: number;
  missed: number;
  phase: SkyportPhase;
  paused: boolean;
  speed: 1 | 2;
  totalHandled: number;
  seasonDays: number;
  log: string[];
}

export function createSkyportState(): SkyportState {
  return {
    day: 1,
    credits: 250,
    gates: 2,
    runways: 1,
    staff: 4,
    flights: 0,
    handled: 0,
    missed: 0,
    phase: 'ready',
    paused: false,
    speed: 1,
    totalHandled: 0,
    seasonDays: SKYPORT_DAYS,
    log: ['Skyport ready. Two gates, one runway, four crew.'],
  };
}

export function slotCapacity(state: SkyportState): number {
  return Math.min(state.gates * 4, state.runways * 6, state.staff * 3);
}

export function flightDemand(day: number): number {
  return Math.max(6, Math.round(10 + Math.sin((day - 1) * 0.58) * 3 + day * 0.18));
}

export function openGate(state: SkyportState): SkyportState {
  if (state.phase !== 'running' || state.gates >= 5 || state.credits < 100) return state;
  return {
    ...state,
    credits: state.credits - 100,
    gates: state.gates + 1,
    log: ['Opened another gate.', ...state.log].slice(0, 4),
  };
}

export function openRunway(state: SkyportState): SkyportState {
  if (state.phase !== 'running' || state.runways >= 3 || state.credits < 160) return state;
  return {
    ...state,
    credits: state.credits - 160,
    runways: state.runways + 1,
    log: ['Second runway cleared for traffic.', ...state.log].slice(0, 4),
  };
}

export function hireCrew(state: SkyportState): SkyportState {
  if (state.phase !== 'running' || state.staff >= 10 || state.credits < 45) return state;
  return {
    ...state,
    credits: state.credits - 45,
    staff: state.staff + 1,
    log: ['Hired another ground-crew member.', ...state.log].slice(0, 4),
  };
}

export function startSkyport(state: SkyportState): SkyportState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Control tower online. First wave inbound.'] };
}

export function toggleSkyportPause(state: SkyportState): SkyportState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleSkyportSpeed(state: SkyportState): SkyportState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function advanceSkyportDay(state: SkyportState): SkyportState {
  if (state.phase !== 'running' || state.paused) return state;

  const flights = flightDemand(state.day);
  const capacity = slotCapacity(state);
  const handled = Math.min(flights, capacity);
  const missed = flights - handled;
  const revenue = handled * 65;
  const costs = state.gates * 30 + state.runways * 60 + state.staff * 20;
  const penalty = missed * 12;
  const profit = revenue - costs - penalty;
  const nextDay = state.day + 1;
  const finished = nextDay > state.seasonDays;
  const log = [...state.log];

  log.unshift(
    `Day ${state.day}: ${handled}/${flights} flights · ${profit >= 0 ? '+' : ''}${profit} credits.`,
  );
  if (missed > 0) log.unshift(`${missed} flights diverted — capacity is short.`);
  if (finished) log.unshift(`Control closed with ${state.credits + profit} credits.`);

  return {
    ...state,
    day: finished ? state.seasonDays : nextDay,
    credits: state.credits + profit,
    flights,
    handled,
    missed,
    totalHandled: state.totalHandled + handled,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}
