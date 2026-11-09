import { describe, expect, it } from 'vitest';
import { SCENARIOS, scenarioById, type ScenarioId } from './scenarios';
import {
  DAYS,
  INTERVENTION_COSTS,
  START_BUDGET,
  aliveSpecies,
  createEcology,
  gradeFor,
  logisticGrowth,
  scoreRun,
  seasonMultiplier,
  stepDay,
  type EcologyState,
} from './simulation';
import type { SpeciesId } from './species';

function counts(overrides: Partial<Record<SpeciesId, number>>): Record<SpeciesId, number> {
  return {
    kelp: 0,
    glowmoss: 0,
    grazer: 0,
    burrower: 0,
    skimmer: 0,
    'reef-hunter': 0,
    ...overrides,
  };
}

function clone(state: EcologyState): EcologyState {
  return {
    ...state,
    populations: { ...state.populations },
    log: [...state.log],
    extinct: [...state.extinct],
    biomass: [...state.biomass],
  };
}

describe('rift ecology populations', () => {
  it('creates a fresh run with every species and a starting budget', () => {
    const state = createEcology('kelp-forest');

    expect(state.scenarioId).toBe('kelp-forest');
    expect(state.day).toBe(1);
    expect(state.status).toBe('running');
    expect(state.budget).toBe(START_BUDGET);
    expect(state.extinct).toEqual([]);
    expect(state.log).toEqual([]);
    for (const value of Object.values(state.populations)) expect(value).toBeGreaterThan(0);
  });

  it('follows the logistic growth curve and saturates at carrying capacity', () => {
    expect(logisticGrowth(100, 0.4, 400)).toBeCloseTo(130, 5);
    expect(logisticGrowth(400, 0.4, 400)).toBeCloseTo(400, 5);
    expect(logisticGrowth(500, 0.4, 400)).toBeLessThan(500);
  });

  it('caps an overfull producer instead of letting it grow', () => {
    const state = createEcology('kelp-forest');
    state.populations = counts({ kelp: 3000, glowmoss: 100, grazer: 10 });
    const before = state.populations.kelp;

    stepDay(state);

    expect(state.populations.kelp).toBeLessThan(before);
  });

  it('lets a predator suppress its prey', () => {
    const withPredator = createEcology('kelp-forest');
    const withoutPredator = clone(withPredator);
    withoutPredator.populations = counts({ ...withoutPredator.populations, skimmer: 0 });

    stepDay(withPredator);
    stepDay(withoutPredator);

    expect(withoutPredator.populations.grazer).toBeGreaterThan(withPredator.populations.grazer);
  });

  it('starves predators when prey is scarce', () => {
    const state = createEcology('kelp-forest');
    state.populations = counts({ kelp: 400, glowmoss: 100, grazer: 0, skimmer: 40 });

    stepDay(state);
    stepDay(state);

    expect(state.populations.skimmer).toBeLessThan(40);
  });

  it('follows the scenario season curve', () => {
    const scenario = scenarioById('kelp-forest');

    expect(seasonMultiplier(scenario, 1)).toBeCloseTo(scenario.seasons[0], 5);
    expect(seasonMultiplier(scenario, 16)).toBeCloseTo(scenario.seasons[1], 5);
    expect(seasonMultiplier(scenario, 31)).toBeCloseTo(scenario.seasons[2], 5);
    expect(seasonMultiplier(scenario, 46)).toBeCloseTo(scenario.seasons[3], 5);
  });
});

describe('rift ecology interventions', () => {
  it('plants producers and spends budget', () => {
    const state = createEcology('kelp-forest');
    const before = state.populations.kelp;

    stepDay(state, 'plant', 'kelp');

    expect(state.populations.kelp).toBeGreaterThan(before);
    expect(state.budget).toBe(START_BUDGET - INTERVENTION_COSTS.plant);
    expect(state.log.some((line) => line.toLowerCase().includes('plant'))).toBe(true);
  });

  it('culls a species and spends budget', () => {
    const state = createEcology('kelp-forest');
    const before = state.populations.skimmer;

    stepDay(state, 'cull', 'skimmer');

    expect(state.populations.skimmer).toBeLessThan(before);
    expect(state.budget).toBe(START_BUDGET - INTERVENTION_COSTS.cull);
  });

  it('protects a species from predation for a day', () => {
    const protectedRun = createEcology('kelp-forest');
    const openRun = createEcology('kelp-forest');

    stepDay(protectedRun, 'protect', 'kelp');
    stepDay(openRun);

    expect(protectedRun.populations.kelp).toBeGreaterThan(openRun.populations.kelp);
    expect(protectedRun.budget).toBe(START_BUDGET - INTERVENTION_COSTS.protect);
  });

  it('raises producer carrying capacity with a flow adjustment', () => {
    const flowed = createEcology('kelp-forest');
    const plain = createEcology('kelp-forest');
    flowed.populations = counts({ kelp: 700, glowmoss: 120, grazer: 10 });
    plain.populations = counts({ kelp: 700, glowmoss: 120, grazer: 10 });

    stepDay(flowed, 'flow', 'kelp');
    stepDay(plain);

    expect(flowed.populations.kelp).toBeGreaterThan(plain.populations.kelp);
    expect(flowed.budget).toBe(START_BUDGET - INTERVENTION_COSTS.flow);
  });

  it('refuses an unaffordable intervention', () => {
    const refused = createEcology('kelp-forest');
    const plain = createEcology('kelp-forest');
    refused.budget = 0;

    stepDay(refused, 'plant', 'kelp');
    stepDay(plain);

    expect(refused.populations).toEqual(plain.populations);
    expect(refused.budget).toBe(0);
    expect(refused.log.some((line) => line.toLowerCase().includes('budget'))).toBe(true);
  });
});

describe('rift ecology endings and scoring', () => {
  it('flags an extinct species', () => {
    const state = createEcology('kelp-forest');
    state.populations = counts({ kelp: 400, glowmoss: 120, grazer: 20, burrower: 0, skimmer: 8 });

    stepDay(state);

    expect(state.extinct).toContain('burrower');
    expect(state.log.some((line) => line.includes('extinct'))).toBe(true);
  });

  it('ends the run when the ecosystem collapses', () => {
    const state = createEcology('kelp-forest');
    state.populations = counts({});

    stepDay(state);

    expect(state.status).toBe('crashed');
    expect(state.log.some((line) => line.toLowerCase().includes('collapse'))).toBe(true);

    const frozenDay = state.day;
    stepDay(state);
    expect(state.day).toBe(frozenDay);
  });

  it('completes the season on day 60', () => {
    const state = createEcology('kelp-forest');
    state.day = DAYS;

    stepDay(state);

    expect(state.status).toBe('finished');
    expect(state.log.some((line) => line.includes('Season complete'))).toBe(true);
    expect(scoreRun(state).total).toBeGreaterThan(0);
  });

  it('rewards biodiversity, stability and unspent budget', () => {
    const healthy = createEcology('kelp-forest');
    healthy.biomass = [600, 605, 602, 604];
    const degraded = createEcology('kelp-forest');
    degraded.populations = counts({ kelp: 5 });
    degraded.extinct = ['glowmoss', 'grazer', 'burrower', 'skimmer', 'reef-hunter'];
    degraded.biomass = [900, 300, 700, 120];
    degraded.budget = 0;

    const healthyScore = scoreRun(healthy);
    const degradedScore = scoreRun(degraded);

    expect(healthyScore.survival).toBeGreaterThan(degradedScore.survival);
    expect(healthyScore.biodiversity).toBeGreaterThan(degradedScore.biodiversity);
    expect(healthyScore.stability).toBeGreaterThan(degradedScore.stability);
    expect(healthyScore.budget).toBeGreaterThan(degradedScore.budget);
    expect(healthyScore.total).toBeGreaterThan(degradedScore.total);
  });

  it('maps totals to documented grades', () => {
    expect(gradeFor(95)).toBe('S');
    expect(gradeFor(90)).toBe('S');
    expect(gradeFor(80)).toBe('A');
    expect(gradeFor(65)).toBe('B');
    expect(gradeFor(45)).toBe('C');
    expect(gradeFor(44)).toBe('D');
  });

  it('counts scenario targets against the live populations', () => {
    const scenario = scenarioById('kelp-forest');
    const state = createEcology('kelp-forest');
    const targetIds = Object.keys(scenario.targets) as SpeciesId[];
    expect(targetIds.length).toBeGreaterThan(0);

    for (const id of targetIds) state.populations[id] = (scenario.targets[id] ?? 0) + 10;

    const score = scoreRun(state);
    expect(score.targetsMet).toBe(targetIds.length);
    expect(score.targetCount).toBe(targetIds.length);
  });

  it('lists only species that are still alive', () => {
    const state = createEcology('kelp-forest');
    state.populations = counts({ kelp: 100, grazer: 4 });

    const alive = aliveSpecies(state);

    expect(alive).toContain('kelp');
    expect(alive).toContain('grazer');
    expect(alive).not.toContain('glowmoss');
  });

  it('runs identically from the same seed and interventions', () => {
    const first = createEcology('rift-marsh');
    const second = createEcology('rift-marsh');
    const plan: Array<[Parameters<typeof stepDay>[1], Parameters<typeof stepDay>[2]]> = [
      [undefined, undefined],
      ['plant', 'glowmoss'],
      [undefined, undefined],
      ['protect', 'burrower'],
      ['cull', 'reef-hunter'],
    ];

    for (const [intervention, species] of plan) {
      stepDay(first, intervention, species);
      stepDay(second, intervention, species);
    }

    expect(second.populations).toEqual(first.populations);
    expect(second.log).toEqual(first.log);
    expect(second.budget).toBe(first.budget);
    expect(second.day).toBe(first.day);
  });

  it('ships three scenarios with distinct targets', () => {
    expect(SCENARIOS.map((scenario) => scenario.id)).toEqual<ScenarioId[]>([
      'kelp-forest',
      'rift-marsh',
      'ember-ridge',
    ]);
    for (const scenario of SCENARIOS) {
      expect(Object.keys(scenario.targets).length).toBeGreaterThan(0);
    }
  });
});
