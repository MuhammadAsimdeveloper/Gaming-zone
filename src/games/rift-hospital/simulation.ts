export const HOSPITAL_DAYS = 20;
export const HOSPITAL_TARGET = 4000;

export type HospitalPhase = 'ready' | 'running' | 'over';

export interface HospitalState {
  day: number;
  credits: number;
  beds: number;
  doctors: number;
  nurses: number;
  patients: number;
  treated: number;
  critical: number;
  reputation: number;
  phase: HospitalPhase;
  paused: boolean;
  speed: 1 | 2;
  totalTreated: number;
  seasonDays: number;
  log: string[];
}

export function createHospitalState(): HospitalState {
  return {
    day: 1,
    credits: 250,
    beds: 8,
    doctors: 3,
    nurses: 4,
    patients: 0,
    treated: 0,
    critical: 0,
    reputation: 70,
    phase: 'ready',
    paused: false,
    speed: 1,
    totalTreated: 0,
    seasonDays: HOSPITAL_DAYS,
    log: ['Clinic ready. Eight beds, three doctors and four nurses on shift.'],
  };
}

export function hospitalCapacity(state: HospitalState): number {
  return Math.min(state.beds, state.doctors * 4, state.nurses * 3);
}

export function patientDemand(day: number): number {
  return Math.max(8, Math.round(22 + Math.sin((day - 1) * 0.52) * 4 + day * 0.28));
}

export function addBed(state: HospitalState): HospitalState {
  if (state.phase !== 'running' || state.beds >= 20 || state.credits < 80) return state;
  return { ...state, credits: state.credits - 80, beds: state.beds + 2, log: ['Two beds added.', ...state.log].slice(0, 4) };
}

export function hireDoctor(state: HospitalState): HospitalState {
  if (state.phase !== 'running' || state.doctors >= 8 || state.credits < 100) return state;
  return { ...state, credits: state.credits - 100, doctors: state.doctors + 1, log: ['A doctor joined the shift.', ...state.log].slice(0, 4) };
}

export function hireNurse(state: HospitalState): HospitalState {
  if (state.phase !== 'running' || state.nurses >= 12 || state.credits < 55) return state;
  return { ...state, credits: state.credits - 55, nurses: state.nurses + 1, log: ['A nurse joined the shift.', ...state.log].slice(0, 4) };
}

export function startHospital(state: HospitalState): HospitalState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Clinic doors open. First patients arriving.'] };
}

export function toggleHospitalPause(state: HospitalState): HospitalState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleHospitalSpeed(state: HospitalState): HospitalState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function advanceHospitalDay(state: HospitalState): HospitalState {
  if (state.phase !== 'running' || state.paused) return state;

  const patients = patientDemand(state.day);
  const critical = Math.round(patients * 0.35);
  const capacity = hospitalCapacity(state);
  const treated = Math.min(patients, capacity);
  const untreated = patients - treated;
  const untreatedCritical = Math.max(0, critical - Math.min(critical, treated));
  const revenue = treated * 50;
  const costs = state.beds * 8 + state.doctors * 35 + state.nurses * 18;
  const penalty = untreatedCritical * 45 + Math.max(0, untreated - untreatedCritical) * 4;
  const profit = revenue - costs - penalty;
  const service = patients > 0 ? treated / patients : 1;
  const reputation = Math.max(0, Math.min(100, Math.round(state.reputation + (service * 100 - state.reputation) * 0.18)));
  const nextDay = state.day + 1;
  const insolvent = state.credits + profit < 0;
  const finished = nextDay > state.seasonDays || insolvent;
  const log = [...state.log];

  log.unshift(
    `Day ${state.day}: ${treated}/${patients} patients · ${profit >= 0 ? '+' : ''}${profit} credits.`,
  );
  if (untreated > 0) log.unshift(`${untreated} patients left untreated — ${untreatedCritical} critical.`);
  if (insolvent) log.unshift('Insolvent: creditors closed the clinic.');
  else if (finished) log.unshift(`Clinic closed with ${state.credits + profit} credits.`);

  return {
    ...state,
    day: finished ? state.day : nextDay,
    credits: state.credits + profit,
    patients,
    treated,
    critical,
    reputation,
    totalTreated: state.totalTreated + treated,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}
