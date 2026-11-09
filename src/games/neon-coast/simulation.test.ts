import { describe, expect, it } from 'vitest';
import { createPlayer } from './player';
import {
  MAX_STEPS,
  SIM_STEP,
  consumeDelta,
  createWorld,
  dayPhase,
  stepWorld,
  type WorldEvent,
  type WorldInput,
} from './simulation';

function neutralInput(): WorldInput {
  return {
    move: { up: false, down: false, left: false, right: false, sprint: false },
    drive: { forward: false, back: false, left: false, right: false, handbrake: false },
    interact: false,
    acceptMission: null,
  };
}

describe('fixed-step budget', () => {
  it('turns a 50 ms frame into three fixed steps', () => {
    const budget = consumeDelta({ accumulator: 0, steps: 0 }, 0.05);
    expect(budget.steps).toBe(3);
    expect(budget.accumulator).toBeGreaterThanOrEqual(0);
    expect(budget.accumulator).toBeLessThan(SIM_STEP);
  });

  it('caps a two-second stall at five steps', () => {
    const budget = consumeDelta({ accumulator: 0, steps: 0 }, 2);
    expect(budget.steps).toBe(MAX_STEPS);
    expect(budget.accumulator).toBeLessThan(SIM_STEP);
  });

  it('ignores negative deltas', () => {
    const budget = consumeDelta({ accumulator: 0, steps: 0 }, -1);
    expect(budget.steps).toBe(0);
    expect(budget.accumulator).toBe(0);
  });
});

describe('world determinism', () => {
  it('produces a deep-equal world from the same seed and scripted input', () => {
    const run = () => {
      let state = createWorld(42);
      for (let tick = 0; tick < 600; tick += 1) {
        const input = neutralInput();
        input.move.right = true;
        state = stepWorld(state, input, SIM_STEP).state;
      }
      return JSON.parse(JSON.stringify(state)) as unknown;
    };
    expect(run()).toEqual(run());
  });
});

describe('day and night', () => {
  it('advances and wraps on a 300-second cycle', () => {
    const start = createWorld(1);
    expect(dayPhase(start.timeOfDay)).toBe('day');

    const later = stepWorld(start, neutralInput(), 150).state;
    expect(later.timeOfDay).toBeCloseTo(0.86, 5);
    expect(dayPhase(later.timeOfDay)).toBe('night');

    const wrapped = stepWorld(start, neutralInput(), 300).state;
    expect(wrapped.timeOfDay).toBeCloseTo(start.timeOfDay, 5);
  });

  it('names every phase of the clock', () => {
    expect(dayPhase(0.1)).toBe('night');
    expect(dayPhase(0.25)).toBe('dawn');
    expect(dayPhase(0.4)).toBe('day');
    expect(dayPhase(0.7)).toBe('dusk');
  });
});

describe('entering and exiting the Vela', () => {
  it('only changes the controlled entity when the player is beside the car', () => {
    const far = { ...createWorld(5), player: createPlayer(300, 300) };
    const refused = stepWorld(far, { ...neutralInput(), interact: true }, SIM_STEP);
    expect(refused.state.inVehicle).toBe(false);
    expect(refused.events).not.toContainEqual({ type: 'enter-car' });

    const nearby = createWorld(5);
    const entered = stepWorld(nearby, { ...neutralInput(), interact: true }, SIM_STEP);
    expect(entered.events).toContainEqual({ type: 'enter-car' });
    expect(entered.state.inVehicle).toBe(true);

    const exited = stepWorld(entered.state, { ...neutralInput(), interact: true }, SIM_STEP);
    expect(exited.events).toContainEqual({ type: 'exit-car' });
    expect(exited.state.inVehicle).toBe(false);
  });

  it('drives the car, not the walker, while seated', () => {
    let state = createWorld(5);
    state = stepWorld(state, { ...neutralInput(), interact: true }, SIM_STEP).state;
    const input = neutralInput();
    input.drive.forward = true;
    input.move.right = true;
    const driven = stepWorld(state, input, SIM_STEP).state;
    expect(driven.vehicle.speed).toBeGreaterThan(0);
    expect(driven.player.x).toBe(driven.vehicle.x);
    expect(driven.player.z).toBe(driven.vehicle.z);
  });
});

describe('mission events', () => {
  it('emits acceptance, pickup and delivery exactly once', () => {
    let state = createWorld(9);

    const accepted = stepWorld(
      state,
      { ...neutralInput(), acceptMission: 'tideglass-courier' },
      SIM_STEP,
    );
    expect(accepted.events).toEqual([
      { type: 'mission-accepted', id: 'tideglass-courier', name: 'Tideglass Courier' },
    ]);
    state = accepted.state;

    const repeat = stepWorld(
      state,
      { ...neutralInput(), acceptMission: 'tideglass-courier' },
      SIM_STEP,
    );
    expect(repeat.events).toEqual([]);
    state = repeat.state;

    state = { ...state, player: createPlayer(560, 510) };
    const picked = stepWorld(state, neutralInput(), SIM_STEP);
    expect(picked.events).toEqual<WorldEvent[]>([{ type: 'checkpoint', id: 'courier-pickup' }]);
    state = picked.state;

    const repeatedPickup = stepWorld(state, neutralInput(), SIM_STEP);
    expect(repeatedPickup.events).toEqual([]);
    state = repeatedPickup.state;

    state = { ...state, player: createPlayer(1160, 1010) };
    const delivered = stepWorld(state, neutralInput(), SIM_STEP);
    expect(delivered.events).toEqual<WorldEvent[]>([
      {
        type: 'mission-complete',
        id: 'tideglass-courier',
        reward: 450,
        elapsed: expect.any(Number) as unknown as number,
        shards: 0,
      },
    ]);
    expect(delivered.state.mission?.status).toBe('complete');

    const afterFinish = stepWorld(delivered.state, neutralInput(), SIM_STEP);
    expect(afterFinish.events).toEqual([]);
  });

  it('emits each landmark discovery once', () => {
    let state = { ...createWorld(9), player: createPlayer(300, 300) };
    state = stepWorld(state, { ...neutralInput(), acceptMission: 'landmark-trail' }, SIM_STEP).state;
    expect(state.mission?.id).toBe('landmark-trail');

    state = { ...state, player: createPlayer(560, 510) };
    const first = stepWorld(state, neutralInput(), SIM_STEP);
    expect(first.events).toEqual<WorldEvent[]>([{ type: 'discover', id: 'tideglass-market' }]);

    const repeat = stepWorld(first.state, neutralInput(), SIM_STEP);
    expect(repeat.events).toEqual([]);
  });

  it('starts a repeatable Glow Run with a fresh seeded layout', () => {
    let state = createWorld(9);
    const accepted = stepWorld(state, { ...neutralInput(), acceptMission: 'glow-run' }, SIM_STEP);
    state = accepted.state;
    expect(state.mission?.shards).toHaveLength(8);

    const firstLayout = state.mission?.shards;
    state = { ...state, mission: { ...state.mission!, status: 'complete', collected: [0, 1, 2, 3, 4, 5, 6, 7] } };
    const again = stepWorld(state, { ...neutralInput(), acceptMission: 'glow-run' }, SIM_STEP);
    expect(again.state.mission?.status).toBe('active');
    expect(again.state.mission?.shards).toHaveLength(8);
    expect(again.state.mission?.shards).not.toEqual(firstLayout);
  });
});
