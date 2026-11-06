import { describe, expect, it } from 'vitest';
import {
  COLONY_DAYS,
  COLONY_TARGET,
  advanceColonyDay,
  assignWorker,
  buildColony,
  colonyOutcome,
  colonyScore,
  createColonyState,
  jobOutput,
  recallWorker,
  startColony,
  unassignedWorkers,
} from './simulation';

function running() {
  return startColony(createColonyState());
}

describe('Rift Colony simulation', () => {
  it('starts with six assigned colonists and no unassigned workers', () => {
    const state = createColonyState();
    expect(state.population).toBe(6);
    expect(unassignedWorkers(state)).toBe(0);
    expect(state.phase).toBe('ready');
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startColony(state)).toBe(state);
  });

  it('recalls and assigns a worker', () => {
    const state = running();
    const recalled = recallWorker(state, 'lab');
    expect(recalled.workers.lab).toBe(0);
    expect(unassignedWorkers(recalled)).toBe(1);
    expect(assignWorker(recalled, 'farm').workers.farm).toBe(3);
  });

  it('computes per-job output with upgrades', () => {
    const state = running();
    expect(jobOutput(state, 'farm')).toBe(6);
    expect(jobOutput({ ...state, upgrades: { ...state.upgrades, farm: 1 } }, 'farm')).toBe(8);
  });

  it('builds a habitat ring and increases capacity', () => {
    const state = { ...running(), materials: 20 };
    const built = buildColony(state, 'habitat');
    expect(built.capacity).toBe(12);
    expect(built.materials).toBe(11);
  });

  it('advances a day and consumes food and power', () => {
    const state = running();
    const next = advanceColonyDay(state);
    expect(next.day).toBe(2);
    expect(next.food).toBe(state.food + jobOutput(state, 'farm') - state.population);
    expect(next.power).toBe(state.power + jobOutput(state, 'power') - state.population);
    expect(next.materials).toBeGreaterThan(state.materials);
  });

  it('loses morale when food goes negative', () => {
    const state = { ...running(), food: 0, workers: { farm: 0, power: 2, mine: 3, lab: 1 } };
    const next = advanceColonyDay(state);
    expect(next.morale).toBeLessThan(state.morale);
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= COLONY_DAYS; day += 1) state = advanceColonyDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(COLONY_DAYS);
    expect(COLONY_TARGET).toBeGreaterThan(0);
  });

  it('computes a score from population, research and materials', () => {
    const state = { ...running(), population: 10, research: 5, materials: 3 };
    expect(colonyScore(state)).toBe(1000 + 75 + 6);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceColonyDay(paused)).toBe(paused);
  });

  it('only wins when morale stays at or above the floor', () => {
    const thriving = { ...running(), population: 20, morale: 70 };
    expect(colonyOutcome(thriving)).toBe('win');
    expect(colonyOutcome({ ...thriving, morale: 50 })).toBe('win');
    expect(colonyOutcome({ ...thriving, morale: 49 })).toBe('loss');
  });

  it('loses when morale holds but the score misses the target', () => {
    const underTarget = { ...running(), population: 6, morale: 90 };
    expect(colonyScore(underTarget)).toBeLessThan(COLONY_TARGET);
    expect(colonyOutcome(underTarget)).toBe('loss');
  });
});
