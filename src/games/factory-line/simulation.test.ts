import { describe, expect, it } from 'vitest';
import {
  FACTORY_DAYS,
  FACTORY_TARGET,
  advanceFactoryDay,
  buyMachine,
  createFactoryState,
  factoryOutput,
  hireOperator,
  installAutomation,
  orderDemand,
  startFactory,
} from './simulation';

function running() {
  return startFactory(createFactoryState());
}

describe('Factory Line simulation', () => {
  it('starts ready with three machines and four operators', () => {
    const state = createFactoryState();
    expect(state.phase).toBe('ready');
    expect(factoryOutput(state)).toBe(40);
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startFactory(state)).toBe(state);
  });

  it('buys machines, hires operators and installs automation', () => {
    const state = { ...running(), credits: 500 };
    const machine = buyMachine(state);
    expect(machine.machines).toBe(4);
    expect(machine.credits).toBe(380);
    const worker = hireOperator(machine);
    expect(worker.workers).toBe(5);
    expect(worker.credits).toBe(335);
    const automated = installAutomation(worker);
    expect(automated.automation).toBe(1);
    expect(automated.credits).toBe(225);
    expect(factoryOutput(automated)).toBeGreaterThan(factoryOutput(worker));
  });

  it('computes a deterministic order book', () => {
    expect(orderDemand(4)).toBe(orderDemand(4));
    for (let day = 1; day <= FACTORY_DAYS; day += 1) expect(orderDemand(day)).toBeGreaterThan(0);
  });

  it('produces up to capacity and records the backlog', () => {
    const state = running();
    const next = advanceFactoryDay(state);
    expect(next.produced).toBe(Math.min(orderDemand(state.day), factoryOutput(state)));
    expect(next.totalProduced).toBe(next.produced);
    expect(next.credits).not.toBe(state.credits);
  });

  it('penalises orders beyond capacity', () => {
    const state = { ...running(), machines: 0, workers: 0 };
    const next = advanceFactoryDay(state);
    expect(next.produced).toBe(0);
    expect(next.credits).toBeLessThan(state.credits);
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= FACTORY_DAYS; day += 1) state = advanceFactoryDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(FACTORY_DAYS);
    expect(FACTORY_TARGET).toBeGreaterThan(0);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceFactoryDay(paused)).toBe(paused);
  });

  it('closes early when the line cannot pay its bills', () => {
    const strained = { ...running(), credits: 10, machines: 1, workers: 1 };

    const next = advanceFactoryDay(strained);

    expect(next.credits).toBeLessThan(0);
    expect(next.phase).toBe('over');
    expect(next.log.some((entry) => /insolvent/i.test(entry))).toBe(true);
  });
});
