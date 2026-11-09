import { describe, expect, it } from 'vitest';
import { NPC_IDS } from './npcs';
import {
  DAYS,
  SLOTS_PER_DAY,
  advanceDay,
  applyChoice,
  createLife,
  performActivity,
  weatherFor,
  type LifeState,
} from './simulation';

function fresh(seed = 7): LifeState {
  return createLife(seed);
}

describe('rift life calendar', () => {
  it('starts on day one of a fresh run', () => {
    const state = fresh();
    expect(state.day).toBe(1);
    expect(state.slot).toBe(0);
    expect(state.status).toBe('playing');
    expect(state.endingId).toBeNull();
    expect(['clear', 'rain', 'storm']).toContain(state.weather);
  });

  it('gives each day three slots and rolls the calendar on the fourth advance', () => {
    const state = fresh();
    advanceDay(state);
    advanceDay(state);
    advanceDay(state);
    expect(state.day).toBe(1);
    expect(state.slot).toBe(SLOTS_PER_DAY);

    advanceDay(state);
    expect(state.day).toBe(2);
    expect(state.slot).toBe(0);
  });

  it('allows three activities per day and blocks a fourth', () => {
    const state = fresh();
    state.energy = 100;
    for (let index = 0; index < SLOTS_PER_DAY; index += 1) {
      const events = performActivity(state, 'work');
      expect(events.some((event) => event.type === 'blocked')).toBe(false);
    }
    const before = { ...state };
    const blocked = performActivity(state, 'work');
    expect(blocked.some((event) => event.type === 'blocked')).toBe(true);
    expect(state.slot).toBe(before.slot);
    expect(state.jobProgress).toBe(before.jobProgress);

    advanceDay(state);
    expect(state.day).toBe(2);
    expect(state.slot).toBe(0);
  });

  it('spends energy and clamps it at the maximum', () => {
    const state = fresh();
    const start = state.energy;
    performActivity(state, 'work');
    expect(state.energy).toBe(start - 18);

    state.energy = 90;
    state.slot = 0;
    performActivity(state, 'rest');
    expect(state.energy).toBe(100);
  });

  it('blocks every activity except rest when energy runs out', () => {
    const state = fresh();
    state.energy = 0;
    for (const activity of ['work', 'community', 'mara'] as const) {
      const events = performActivity(state, activity);
      expect(events.some((event) => event.type === 'blocked')).toBe(true);
    }
    expect(state.slot).toBe(0);

    const rested = performActivity(state, 'rest');
    expect(rested.some((event) => event.type === 'blocked')).toBe(false);
    expect(state.energy).toBeGreaterThan(0);
    expect(performActivity(state, 'work').some((event) => event.type === 'blocked')).toBe(false);
  });

  it('raises job progress with work and community with community work only', () => {
    const state = fresh();
    state.energy = 100;
    performActivity(state, 'work');
    expect(state.jobProgress).toBeGreaterThan(0);
    expect(state.community).toBe(0);

    state.slot = 0;
    performActivity(state, 'community');
    expect(state.community).toBeGreaterThan(0);
  });
});

describe('rift life relationships', () => {
  it('raises only the visited relationship', () => {
    const state = fresh();
    state.energy = 100;
    performActivity(state, 'mara');
    expect(state.relationships.mara).toBeGreaterThan(0);
    for (const id of NPC_IDS) {
      if (id === 'mara') continue;
      expect(state.relationships[id]).toBe(0);
    }
  });

  it('applies conversation choice deltas without spending another slot', () => {
    const state = fresh();
    state.energy = 100;
    const events = performActivity(state, 'sena');
    const conversation = events.find((event) => event.type === 'conversation');
    expect(conversation).toBeDefined();
    expect(conversation?.choices).toHaveLength(2);

    const slot = state.slot;
    const before = state.relationships.sena;
    const choice = conversation!.choices![1];
    applyChoice(state, 'sena', 1);
    expect(state.relationships.sena).toBe(before + choice.relationship);
    expect(state.slot).toBe(slot);
  });

  it('ignores an out-of-range conversation choice', () => {
    const state = fresh();
    state.energy = 100;
    performActivity(state, 'ilo');
    const before = { ...state.relationships };
    const events = applyChoice(state, 'ilo', 5);
    expect(events.some((event) => event.type === 'blocked')).toBe(true);
    expect(state.relationships).toEqual(before);
  });

  it('unlocks a relationship scene at 25 and fires it only once', () => {
    const state = fresh();
    state.energy = 1000;
    let scenes = 0;
    for (let index = 0; index < 3; index += 1) {
      state.slot = 0;
      const events = performActivity(state, 'mara');
      scenes += events.filter((event) => event.type === 'scene').length;
    }
    expect(state.relationships.mara).toBeGreaterThanOrEqual(25);
    expect(scenes).toBe(1);
    expect(state.flags).toContain('scene:mara');

    state.slot = 0;
    const again = performActivity(state, 'mara');
    expect(again.some((event) => event.type === 'scene')).toBe(false);
  });

  it('lets every NPC reach the 75 arc inside the 21 days', () => {
    const state = fresh(11);
    let guard = 0;
    while (state.status === 'playing' && guard < 400) {
      guard += 1;
      if (state.slot >= SLOTS_PER_DAY) {
        advanceDay(state);
        continue;
      }
      const target = NPC_IDS.find((id) => state.relationships[id] < 75);
      if (!target) break;
      if (state.energy < 6) {
        performActivity(state, 'rest');
        continue;
      }
      performActivity(state, target);
    }
    for (const id of NPC_IDS) {
      expect(state.relationships[id]).toBeGreaterThanOrEqual(75);
    }
  });
});

describe('rift life weather and endings hooks', () => {
  it('derives weather deterministically from the seed and day', () => {
    for (let day = 1; day <= DAYS; day += 1) {
      expect(weatherFor(1234, day)).toBe(weatherFor(1234, day));
    }
    const first = Array.from({ length: DAYS }, (_, index) => weatherFor(1234, index + 1));
    const second = Array.from({ length: DAYS }, (_, index) => weatherFor(4321, index + 1));
    expect(first).not.toEqual(second);
  });

  it('finishes the run when the calendar rolls past day 21', () => {
    const state = fresh(5);
    state.day = DAYS;
    state.slot = SLOTS_PER_DAY;
    const events = advanceDay(state);
    expect(state.status).toBe('finished');
    expect(state.endingId).not.toBeNull();
    expect(events.some((event) => event.type === 'ending')).toBe(true);
  });

  it('keeps endingId null until the run finishes', () => {
    const state = fresh(9);
    state.energy = 100;
    performActivity(state, 'work');
    expect(state.endingId).toBeNull();
  });
});
