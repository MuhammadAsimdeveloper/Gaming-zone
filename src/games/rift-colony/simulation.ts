export const COLONY_DAYS = 24;
export const COLONY_TARGET = 1400;
export const COLONY_START_POPULATION = 6;

export type JobId = 'farm' | 'power' | 'mine' | 'lab';
export type ColonyPhase = 'ready' | 'running' | 'over';

export interface JobSpec {
  id: JobId;
  name: string;
  description: string;
  output: number;
  color: string;
}

export const JOBS: Record<JobId, JobSpec> = {
  farm: { id: 'farm', name: 'Farm deck', description: 'Grows food for the colony.', output: 3, color: '#4ade9d' },
  power: { id: 'power', name: 'Reactor crew', description: 'Keeps the habitat powered.', output: 3, color: '#4c8dff' },
  mine: { id: 'mine', name: 'Ore line', description: 'Mines materials for construction.', output: 2, color: '#fbbf24' },
  lab: { id: 'lab', name: 'Rift lab', description: 'Produces research points.', output: 1, color: '#b285ff' },
};

export const JOB_ORDER: ReadonlyArray<JobId> = ['farm', 'power', 'mine', 'lab'];

export interface ColonyState {
  day: number;
  population: number;
  capacity: number;
  food: number;
  power: number;
  materials: number;
  research: number;
  morale: number;
  workers: Record<JobId, number>;
  upgrades: Record<JobId, number>;
  badDays: number;
  phase: ColonyPhase;
  paused: boolean;
  speed: 1 | 2;
  seasonDays: number;
  log: string[];
}

export interface BuildSpec {
  id: 'habitat' | 'farm' | 'power' | 'lab';
  name: string;
  description: string;
  cost: number;
  max: number;
}

export const COLONY_BUILDS: Record<BuildSpec['id'], BuildSpec> = {
  habitat: { id: 'habitat', name: 'Habitat ring', description: '+4 population capacity.', cost: 9, max: 4 },
  farm: { id: 'farm', name: 'Hydroponic tier', description: '+1 food per farm worker.', cost: 8, max: 3 },
  power: { id: 'power', name: 'Reactor cell', description: '+1 power per reactor worker.', cost: 8, max: 3 },
  lab: { id: 'lab', name: 'Rift sensor', description: '+1 research per lab worker.', cost: 10, max: 3 },
};

export const BUILD_ORDER: ReadonlyArray<BuildSpec['id']> = ['habitat', 'farm', 'power', 'lab'];

export function assignedWorkers(state: ColonyState): number {
  return JOB_ORDER.reduce((sum, job) => sum + state.workers[job], 0);
}

export function unassignedWorkers(state: ColonyState): number {
  return state.population - assignedWorkers(state);
}

export function jobOutput(state: ColonyState, job: JobId): number {
  return state.workers[job] * (JOBS[job].output + state.upgrades[job]);
}

export function createColonyState(): ColonyState {
  return {
    day: 1,
    population: COLONY_START_POPULATION,
    capacity: 8,
    food: 20,
    power: 20,
    materials: 10,
    research: 0,
    morale: 70,
    workers: { farm: 2, power: 2, mine: 1, lab: 1 },
    upgrades: { farm: 0, power: 0, mine: 0, lab: 0 },
    badDays: 0,
    phase: 'ready',
    paused: false,
    speed: 1,
    seasonDays: COLONY_DAYS,
    log: ['Colony ready. Six colonists are assigned to the first decks.'],
  };
}

export function startColony(state: ColonyState): ColonyState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', paused: false, log: ['Habitat sealed. The colony clock is running.'] };
}

export function toggleColonyPause(state: ColonyState): ColonyState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleColonySpeed(state: ColonyState): ColonyState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function assignWorker(state: ColonyState, job: JobId): ColonyState {
  if (state.phase !== 'running' || unassignedWorkers(state) <= 0) return state;
  return { ...state, workers: { ...state.workers, [job]: state.workers[job] + 1 } };
}

export function recallWorker(state: ColonyState, job: JobId): ColonyState {
  if (state.phase !== 'running' || state.workers[job] <= 0) return state;
  return { ...state, workers: { ...state.workers, [job]: state.workers[job] - 1 } };
}

export function buildColony(state: ColonyState, id: BuildSpec['id']): ColonyState {
  const spec = COLONY_BUILDS[id];
  if (state.phase !== 'running' || state.materials < spec.cost) return state;
  if (id === 'habitat' && state.capacity >= 8 + spec.max * 4) return state;
  if (id !== 'habitat' && state.upgrades[id] >= spec.max) return state;

  const next: ColonyState = {
    ...state,
    materials: state.materials - spec.cost,
    capacity: state.capacity + (id === 'habitat' ? 4 : 0),
    upgrades:
      id === 'habitat'
        ? state.upgrades
        : { ...state.upgrades, [id]: state.upgrades[id] + 1 },
    log: [`Built ${spec.name}.`, ...state.log].slice(0, 4),
  };
  return next;
}

export function advanceColonyDay(state: ColonyState): ColonyState {
  if (state.phase !== 'running' || state.paused) return state;

  const foodProduced = jobOutput(state, 'farm');
  const powerProduced = jobOutput(state, 'power');
  const materialsProduced = jobOutput(state, 'mine');
  const researchProduced = jobOutput(state, 'lab');

  const food = state.food + foodProduced - state.population;
  const power = state.power + powerProduced - state.population;
  const short = food < 0 || power < 0;
  const nextDay = state.day + 1;
  const finished = nextDay > state.seasonDays;
  const log = [...state.log];

  let population = state.population;
  let morale = Math.max(0, Math.min(100, state.morale + (short ? -12 : 2)));
  let badDays = short ? state.badDays + 1 : 0;
  let capacity = state.capacity;
  let workers = state.workers;

  if (badDays >= 2) {
    population = Math.max(1, population - 1);
    badDays = 0;
    morale = Math.max(0, morale - 5);
    const job = [...JOB_ORDER].reverse().find((id) => workers[id] > 0);
    if (job) workers = { ...workers, [job]: workers[job] - 1 };
    log.unshift('A colonist left after repeated shortages.');
  } else if (
    !short &&
    state.day % 3 === 0 &&
    morale >= 60 &&
    population < capacity &&
    food > 8 &&
    power > 8
  ) {
    population += 1;
    log.unshift('A new colonist joined the habitat.');
  }

  if (short) log.unshift('Food or power went negative — morale is falling.');
  if (researchProduced > 0) log.unshift(`Lab produced ${researchProduced} research.`);
  if (finished) log.unshift(`Season closed with ${population} colonists.`);

  return {
    ...state,
    day: finished ? state.seasonDays : nextDay,
    population,
    capacity,
    food: Math.max(0, food),
    power: Math.max(0, power),
    materials: state.materials + materialsProduced,
    research: state.research + researchProduced,
    morale,
    workers,
    badDays,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}

export function colonyScore(state: ColonyState): number {
  return state.population * 100 + state.research * 15 + state.materials * 2;
}
