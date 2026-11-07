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
  type FactoryState,
} from './simulation';

function running() {
  return startFactory(createFactoryState());
}

function playSeason(act: (state: FactoryState) => FactoryState): FactoryState {
  let state = act(running());
  while (state.phase === 'running') state = advanceFactoryDay(act(state));
  return state;
}

// Automate first, then add operators and machines only while the line is short
// of the next three days of orders.
function investInLine() {
  return (state: FactoryState): FactoryState => {
    let next = state;
    for (let step = 0; step < 4; step += 1) {
      if (next.credits < 300) break;
      const horizon = Math.max(orderDemand(next.day), orderDemand(next.day + 1), orderDemand(next.day + 2));
      const short = factoryOutput(next) < horizon;
      if (next.automation < 2) {
        next = installAutomation(next);
        continue;
      }
      if (short && next.workers < 14) {
        next = hireOperator(next);
        continue;
      }
      if (short && next.machines < 9) {
        next = buyMachine(next);
        continue;
      }
      break;
    }
    return next;
  };
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

  it('lets the order book outgrow the starting line', () => {
    expect(orderDemand(FACTORY_DAYS)).toBeGreaterThan(factoryOutput(createFactoryState()));
  });

  it('rewards automating and expanding over idling through the season', () => {
    const passive = playSeason((state) => state);
    const active = playSeason(investInLine());

    expect(passive.credits).toBeLessThan(FACTORY_TARGET);
    expect(active.credits).toBeGreaterThanOrEqual(FACTORY_TARGET);
  });

  it('closes early when the line cannot pay its bills', () => {
    const strained = { ...running(), credits: 10, machines: 1, workers: 1 };

    const next = advanceFactoryDay(strained);

    expect(next.credits).toBeLessThan(0);
    expect(next.phase).toBe('over');
    expect(next.log.some((entry) => /insolvent/i.test(entry))).toBe(true);
  });
});
