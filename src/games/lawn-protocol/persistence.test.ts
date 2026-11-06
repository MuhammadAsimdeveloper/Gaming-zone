// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { LEVELS } from './content';
import {
  EMPTY_PROGRESS,
  PROGRESS_KEY,
  SETTINGS_KEY,
  isLevelUnlocked,
  loadProgress,
  loadSettings,
  parseProgress,
  parseSettings,
  recordCampaign,
  recordEndless,
  saveProgress,
  saveSettings,
} from './persistence';

describe('Lawn Protocol progress', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to an empty progress record', () => {
    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  });

  it('rejects malformed progress without throwing', () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseProgress({ version: 2, stars: { 'first-light': 3 } })).toEqual(EMPTY_PROGRESS);
    expect(parseProgress({ version: 1, stars: [], endlessBestWave: 4, endlessBestScore: 10 })).toEqual({
      ...EMPTY_PROGRESS,
      endlessBestWave: 4,
      endlessBestScore: 10,
    });
    expect(
      parseProgress({
        version: 1,
        stars: { 'not-a-level': 3, 'first-light': 9, 'core-defense': 2 },
        endlessBestWave: -2,
        endlessBestScore: 12.7,
      }),
    ).toEqual({
      version: 1,
      stars: { 'core-defense': 2 },
      endlessBestWave: 0,
      endlessBestScore: 12,
    });
  });

  it('records campaign stars and keeps the best result', () => {
    const first = recordCampaign(EMPTY_PROGRESS, 'first-light', 2);
    expect(first.improved).toBe(true);
    expect(first.progress.stars['first-light']).toBe(2);

    const worse = recordCampaign(first.progress, 'first-light', 1);
    expect(worse.improved).toBe(false);
    expect(worse.progress.stars['first-light']).toBe(2);

    const better = recordCampaign(worse.progress, 'first-light', 3);
    expect(better.improved).toBe(true);
    expect(better.progress.stars['first-light']).toBe(3);
  });

  it('records endless bests independently', () => {
    const first = recordEndless(EMPTY_PROGRESS, 4, 320);
    expect(first.improvedWave).toBe(true);
    expect(first.improvedScore).toBe(true);

    const lower = recordEndless(first.progress, 3, 300);
    expect(lower.improvedWave).toBe(false);
    expect(lower.improvedScore).toBe(false);
    expect(lower.progress.endlessBestWave).toBe(4);
    expect(lower.progress.endlessBestScore).toBe(320);

    const mixed = recordEndless(lower.progress, 5, 100);
    expect(mixed.improvedWave).toBe(true);
    expect(mixed.improvedScore).toBe(false);
    expect(mixed.progress.endlessBestWave).toBe(5);
    expect(mixed.progress.endlessBestScore).toBe(320);
  });

  it('unlocks levels in order as the previous roof is cleared', () => {
    expect(isLevelUnlocked(0, EMPTY_PROGRESS)).toBe(true);
    expect(isLevelUnlocked(1, EMPTY_PROGRESS)).toBe(false);
    const cleared = recordCampaign(EMPTY_PROGRESS, LEVELS[0].id, 1).progress;
    expect(isLevelUnlocked(1, cleared)).toBe(true);
    expect(isLevelUnlocked(2, cleared)).toBe(false);
  });

  it('round-trips progress through browser storage', () => {
    saveProgress({ version: 1, stars: { 'first-light': 3 }, endlessBestWave: 6, endlessBestScore: 900 });
    expect(loadProgress()).toEqual({
      version: 1,
      stars: { 'first-light': 3 },
      endlessBestWave: 6,
      endlessBestScore: 900,
    });
    expect(window.localStorage.getItem(PROGRESS_KEY)).toContain('first-light');
  });

  it('treats corrupt stored JSON as empty progress', () => {
    window.localStorage.setItem(PROGRESS_KEY, '{oops');
    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  });
});

describe('Lawn Protocol settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to unmuted', () => {
    expect(loadSettings()).toEqual({ version: 1, muted: false });
  });

  it('accepts only boolean mute values', () => {
    expect(parseSettings({ version: 1, muted: true })).toEqual({ version: 1, muted: true });
    expect(parseSettings({ version: 1, muted: 'yes' })).toEqual({ version: 1, muted: false });
    expect(parseSettings({ version: 7, muted: true })).toEqual({ version: 1, muted: false });
  });

  it('round-trips settings', () => {
    saveSettings({ version: 1, muted: true });
    expect(window.localStorage.getItem(SETTINGS_KEY)).toBeTruthy();
    expect(loadSettings()).toEqual({ version: 1, muted: true });
  });
});
