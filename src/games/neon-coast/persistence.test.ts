// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAVE_KEY,
  applyEvent,
  defaultSave,
  loadSave,
  parseSave,
  saveProgress,
  type NeonCoastSave,
} from './persistence';

function sampleSave(): NeonCoastSave {
  return {
    version: 1,
    cash: 450,
    completed: ['tideglass-courier'],
    bestTimes: { 'tideglass-courier': 61.4 },
    bestGlowScore: 4,
    discovered: ['vela-garage', 'tideglass-market'],
    tutorialSeen: true,
    soundOn: false,
  };
}

describe('Neon Coast save parsing', () => {
  it('starts from a clean empty save', () => {
    expect(defaultSave()).toEqual({
      version: 1,
      cash: 0,
      completed: [],
      bestTimes: {},
      bestGlowScore: 0,
      discovered: [],
      tutorialSeen: false,
      soundOn: true,
    });
  });

  it('round-trips a valid save', () => {
    expect(parseSave(sampleSave())).toEqual(sampleSave());
    expect(parseSave(JSON.stringify(sampleSave()))).toEqual(sampleSave());
  });

  it('rejects an unknown save version', () => {
    expect(() => parseSave({ ...sampleSave(), version: 2 })).toThrow(/version/i);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseSave('{oops')).toThrow();
  });

  it('rejects negative or non-finite cash', () => {
    expect(() => parseSave({ ...sampleSave(), cash: -1 })).toThrow(/cash/i);
    expect(() => parseSave({ ...sampleSave(), cash: Number.NaN })).toThrow(/cash/i);
  });

  it('rejects unknown mission ids', () => {
    expect(() => parseSave({ ...sampleSave(), completed: ['atlantis-casino'] })).toThrow(
      /mission/i,
    );
    expect(() =>
      parseSave({ ...sampleSave(), bestTimes: { 'atlantis-casino': 10 } }),
    ).toThrow(/mission/i);
  });

  it('rejects impossible glow scores and unknown landmarks', () => {
    expect(() => parseSave({ ...sampleSave(), bestGlowScore: 9 })).toThrow(/glow/i);
    expect(() => parseSave({ ...sampleSave(), discovered: ['atlantis'] })).toThrow(/landmark/i);
  });
});

describe('Neon Coast browser storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips through localStorage', () => {
    saveProgress(sampleSave());
    expect(window.localStorage.getItem(SAVE_KEY)).toContain('tideglass-courier');
    expect(loadSave()).toEqual(sampleSave());
  });

  it('falls back to defaults on corrupt storage', () => {
    window.localStorage.setItem(SAVE_KEY, '{oops');
    expect(loadSave()).toEqual(defaultSave());
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadSave()).toEqual(defaultSave());
    expect(() => saveProgress(sampleSave())).not.toThrow();
  });
});

describe('Neon Coast progression', () => {
  it('banks cash, completion and the best time', () => {
    const completed = applyEvent(defaultSave(), {
      type: 'mission-complete',
      id: 'tideglass-courier',
      reward: 450,
      elapsed: 61.4,
      shards: 0,
    });
    expect(completed.cash).toBe(450);
    expect(completed.completed).toEqual(['tideglass-courier']);
    expect(completed.bestTimes['tideglass-courier']).toBeCloseTo(61.4);

    const faster = applyEvent(completed, {
      type: 'mission-complete',
      id: 'tideglass-courier',
      reward: 450,
      elapsed: 55,
      shards: 0,
    });
    expect(faster.cash).toBe(900);
    expect(faster.bestTimes['tideglass-courier']).toBeCloseTo(55);
    expect(faster.completed).toEqual(['tideglass-courier']);

    const slower = applyEvent(faster, {
      type: 'mission-complete',
      id: 'tideglass-courier',
      reward: 450,
      elapsed: 90,
      shards: 0,
    });
    expect(slower.bestTimes['tideglass-courier']).toBeCloseTo(55);
  });

  it('keeps the best glow score and pays failed runs per shard', () => {
    let save = applyEvent(defaultSave(), {
      type: 'mission-complete',
      id: 'glow-run',
      reward: 570,
      elapsed: 70,
      shards: 8,
    });
    expect(save.bestGlowScore).toBe(8);
    expect(save.cash).toBe(570);

    save = applyEvent(save, {
      type: 'mission-failed',
      id: 'glow-run',
      reward: 120,
      elapsed: 90,
      shards: 3,
    });
    expect(save.cash).toBe(690);
    expect(save.bestGlowScore).toBe(8);
    expect(save.completed).toEqual(['glow-run']);
  });

  it('records discoveries once and remembers settings', () => {
    let save = applyEvent(defaultSave(), { type: 'discover', id: 'vela-garage' });
    save = applyEvent(save, { type: 'discover', id: 'vela-garage' });
    expect(save.discovered).toEqual(['vela-garage']);

    expect(applyEvent(save, { type: 'sound', on: false }).soundOn).toBe(false);
    expect(applyEvent(save, { type: 'tutorial-seen' }).tutorialSeen).toBe(true);
  });
});
