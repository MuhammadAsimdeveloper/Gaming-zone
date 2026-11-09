import { SPECIES, speciesById, type SpeciesId } from './species';
import { scenarioById, type Scenario, type ScenarioId } from './scenarios';

export type InterventionId = 'plant' | 'cull' | 'protect' | 'flow';

export interface InterventionOption {
  id: InterventionId;
  name: string;
  description: string;
}

export interface EcologyState {
  scenarioId: ScenarioId;
  day: number;
  populations: Record<SpeciesId, number>;
  budget: number;
  log: string[];
  status: 'running' | 'crashed' | 'finished';
  extinct: SpeciesId[];
  biomass: number[];
}

export interface EcologyScore {
  survival: number;
  biodiversity: number;
  stability: number;
  budget: number;
  targetsMet: number;
  targetCount: number;
  total: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
}

export const DAYS = 60;
export const SEASON_LENGTH = 15;
export const START_BUDGET = 24;
export const INTERVENTION_COSTS: Readonly<Record<InterventionId, number>> = {
  plant: 3,
  cull: 3,
  protect: 4,
  flow: 5,
};

export const INTERVENTIONS: readonly InterventionOption[] = [
  { id: 'plant', name: 'Plant', description: 'Seed a producer with new growth worth 25% of its capacity.' },
  { id: 'cull', name: 'Cull', description: 'Remove 30% of one species to relieve pressure.' },
  { id: 'protect', name: 'Protect', description: 'Halve predation on one species for a day.' },
  { id: 'flow', name: 'Adjust flow', description: 'Raise a producer carrying capacity by 25% for a day.' },
];

const MAX_LOG = 80;
const MAX_DAILY_DECLINE = 0.4;
const ALLEE_THRESHOLD = 3;
const ALLE_EFFECT = 0.8;
const CROWDING_MORTALITY = 0.0009;
const FLOW_BONUS = 1.25;
const PLANT_SHARE = 0.25;
const CULL_SHARE = 0.3;
const PROTECT_FACTOR = 0.5;

interface DayEffects {
  protect: SpeciesId | null;
  flow: SpeciesId | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function population(value: number): number {
  if (!Number.isFinite(value) || value < 0.5) return 0;
  return Math.min(9999, value);
}

function log(state: EcologyState, line: string): void {
  state.log.push(line);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

function startPopulations(scenario: Scenario): Record<SpeciesId, number> {
  return { ...scenario.start };
}

export function createEcology(scenarioId: ScenarioId): EcologyState {
  const scenario = scenarioById(scenarioId);
  return {
    scenarioId,
    day: 1,
    populations: startPopulations(scenario),
    budget: START_BUDGET,
    log: [],
    status: 'running',
    extinct: [],
    biomass: [],
  };
}

export function logisticGrowth(current: number, rate: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return current + rate * current * (1 - current / capacity);
}

export function seasonMultiplier(scenario: Scenario, day: number): number {
  const index = Math.floor((((day - 1) % (SEASON_LENGTH * 4)) + SEASON_LENGTH * 4) % (SEASON_LENGTH * 4) / SEASON_LENGTH);
  return scenario.seasons[index] ?? 1;
}

export function carryingCapacity(scenario: Scenario, species: SpeciesId, day: number): number {
  const definition = speciesById(species);
  if (definition.role !== 'producer') return 0;
  return definition.capacity * (scenario.capacityModifier[species] ?? 1) * seasonMultiplier(scenario, day);
}

export function aliveSpecies(state: EcologyState): SpeciesId[] {
  return SPECIES.filter((species) => (state.populations[species.id] ?? 0) > 0).map((species) => species.id);
}

function chargeBudget(state: EcologyState, intervention: InterventionOption): boolean {
  const cost = INTERVENTION_COSTS[intervention.id];
  if (state.budget < cost) {
    log(state, `Not enough budget for ${intervention.name.toLowerCase()}.`);
    return false;
  }
  state.budget -= cost;
  return true;
}

function applyIntervention(
  state: EcologyState,
  scenario: Scenario,
  intervention: InterventionId,
  species: SpeciesId | undefined,
): DayEffects {
  const effects: DayEffects = { protect: null, flow: null };
  const option = INTERVENTIONS.find((candidate) => candidate.id === intervention);
  if (!option) return effects;
  if (!species) {
    log(state, `${option.name} needs a species target.`);
    return effects;
  }

  const target = speciesById(species);
  const populationNow = state.populations[species];

  if ((intervention === 'plant' || intervention === 'flow') && target.role !== 'producer') {
    log(state, `${option.name} only works on producers.`);
    return effects;
  }
  if (populationNow <= 0) {
    log(state, `${target.name} is already extinct.`);
    return effects;
  }
  if (!chargeBudget(state, option)) return effects;

  if (intervention === 'plant') {
    const amount = Math.max(1, Math.round(carryingCapacity(scenario, species, state.day) * PLANT_SHARE));
    state.populations[species] = population(populationNow + amount);
    log(state, `Planted ${target.name} (+${amount}).`);
  } else if (intervention === 'cull') {
    const removed = Math.max(1, Math.round(populationNow * CULL_SHARE));
    state.populations[species] = population(populationNow - removed);
    log(state, `Culled ${removed} ${target.name}.`);
  } else if (intervention === 'protect') {
    effects.protect = species;
    log(state, `Protected ${target.name} for a day.`);
  } else {
    effects.flow = species;
    log(state, `Adjusted flow around ${target.name} for a day.`);
  }

  return effects;
}

function consumption(
  state: EcologyState,
  species: SpeciesId,
  protectedSpecies: SpeciesId | null,
): { eaten: number; gain: number } {
  const consumer = speciesById(species);
  if (!consumer.diet) return { eaten: 0, gain: 0 };

  const prey = state.populations[consumer.diet];
  const eaters = state.populations[species];
  if (eaters <= 0 || prey <= 0) return { eaten: 0, gain: 0 };

  const satiation = prey / (prey + consumer.halfSaturation);
  const shield = protectedSpecies === consumer.diet ? PROTECT_FACTOR : 1;
  const eaten = Math.min(prey, eaters * consumer.appetite * satiation) * shield;

  return { eaten, gain: eaten * consumer.conversion };
}

export function stepDay(state: EcologyState, intervention?: InterventionId, species?: SpeciesId): void {
  if (state.status !== 'running') return;

  const scenario = scenarioById(state.scenarioId);
  const effects: DayEffects = intervention
    ? applyIntervention(state, scenario, intervention, species)
    : { protect: null, flow: null };

  const losses: Record<SpeciesId, number> = {
    kelp: 0,
    glowmoss: 0,
    grazer: 0,
    burrower: 0,
    skimmer: 0,
    'reef-hunter': 0,
  };
  const gains: Record<SpeciesId, number> = { ...losses };

  for (const consumer of SPECIES) {
    if (!consumer.diet) continue;
    const result = consumption(state, consumer.id, effects.protect);
    losses[consumer.diet] += result.eaten;
    gains[consumer.id] += result.gain;
  }

  const next: Record<SpeciesId, number> = { ...state.populations };
  for (const definition of SPECIES) {
    const current = state.populations[definition.id];
    const alleePenalty = current > 0 && current < ALLEE_THRESHOLD ? ALLE_EFFECT : 0;

    if (definition.role === 'producer') {
      const capacity =
        carryingCapacity(scenario, definition.id, state.day) * (effects.flow === definition.id ? FLOW_BONUS : 1);
      const grown = Math.max(logisticGrowth(current, definition.growth, capacity), current * (1 - MAX_DAILY_DECLINE));
      next[definition.id] = population(grown - losses[definition.id] - alleePenalty);
    } else {
      const deaths =
        current * definition.mortality + current * current * CROWDING_MORTALITY + alleePenalty;
      next[definition.id] = population(current + gains[definition.id] - losses[definition.id] - deaths);
    }
  }

  state.populations = next;

  for (const definition of SPECIES) {
    if (next[definition.id] === 0 && !state.extinct.includes(definition.id)) {
      state.extinct.push(definition.id);
      log(state, `${definition.name} went extinct.`);
    }
  }

  const total = SPECIES.reduce((sum, definition) => sum + next[definition.id], 0);
  state.biomass.push(total);
  log(
    state,
    `Day ${state.day}: ${aliveSpecies(state).length} species alive · biomass ${total}.`,
  );

  const producersGone = SPECIES.filter((definition) => definition.role === 'producer').every(
    (definition) => next[definition.id] === 0,
  );
  if (producersGone || state.extinct.length >= 3) {
    state.status = 'crashed';
    log(state, 'The ecosystem collapsed.');
    return;
  }

  state.day += 1;
  if (state.day > DAYS) {
    state.status = 'finished';
    log(state, `Season complete after ${DAYS} days.`);
  }
}

export function gradeFor(total: number): EcologyScore['grade'] {
  if (total >= 90) return 'S';
  if (total >= 80) return 'A';
  if (total >= 65) return 'B';
  if (total >= 45) return 'C';
  return 'D';
}

export function scoreRun(state: EcologyState): EcologyScore {
  const scenario = scenarioById(state.scenarioId);

  const viability = SPECIES.reduce((total, definition) => {
    const start = Math.max(1, scenario.start[definition.id]);
    return total + clamp(state.populations[definition.id] / start, 0, 1);
  }, 0);
  const survival = (viability / SPECIES.length) * 45;

  const ratios = SPECIES.map((definition) =>
    Math.min(1, state.populations[definition.id] / Math.max(1, scenario.start[definition.id])),
  );
  const ratioSum = ratios.reduce((total, value) => total + value, 0);
  const ratioSquares = ratios.reduce((total, value) => total + value * value, 0);
  const evenness = ratioSquares > 0 ? clamp((ratioSum * ratioSum) / (ratios.length * ratioSquares), 0, 1) : 0;
  const biodiversity = evenness * 20;

  let volatility = 0;
  if (state.biomass.length >= 2) {
    let movement = 0;
    for (let index = 1; index < state.biomass.length; index += 1) {
      const previous = Math.max(1, state.biomass[index - 1]);
      movement += Math.min(1, Math.abs(state.biomass[index] - state.biomass[index - 1]) / previous);
    }
    volatility = movement / (state.biomass.length - 1);
  }
  const stability = (1 - volatility) * 20;

  const budget = clamp(state.budget / START_BUDGET, 0, 1) * 8;

  const targetIds = Object.keys(scenario.targets) as SpeciesId[];
  const targetsMet = targetIds.filter((id) => state.populations[id] >= (scenario.targets[id] ?? 0)).length;
  const targetBonus = targetIds.length > 0 ? (targetsMet / targetIds.length) * 10 : 0;

  const total = Math.round(clamp(survival + biodiversity + stability + budget + targetBonus, 0, 100));

  return {
    survival: Math.round(survival),
    biodiversity: Math.round(biodiversity),
    stability: Math.round(stability),
    budget: Math.round(budget),
    targetsMet,
    targetCount: targetIds.length,
    total,
    grade: gradeFor(total),
  };
}
