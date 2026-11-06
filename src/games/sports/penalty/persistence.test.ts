// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  EMPTY_RECORDS,
  RECORDS_KEY,
  SETTINGS_KEY,
  loadRecords,
  loadSettings,
  parseRecords,
  parseSettings,
  recordShootout,
  saveRecords,
  saveSettings,
} from './persistence';

beforeEach(() => {
  window.localStorage.clear();
});

describe('penalty records', () => {
  it('starts empty', () => {
    expect(parseRecords(null)).toEqual(EMPTY_RECORDS);
  });

  it('rejects malformed records', () => {
    expect(parseRecords({ version: 2 })).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ version: 1, wins: -1 })).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ version: 1, wins: '3' })).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ version: 1, wins: Number.NaN })).toEqual(EMPTY_RECORDS);
  });

  it('accepts a valid record and floors fractional counts', () => {
    const records = parseRecords({
      version: 1,
      wins: 4,
      losses: 2,
      bestScore: 720,
      bestSaves: 3,
      streak: 2,
      bestStreak: 3,
      shootouts: 6.9,
    });
    expect(records).toEqual({
      version: 1,
      wins: 4,
      losses: 2,
      bestScore: 720,
      bestSaves: 3,
      streak: 2,
      bestStreak: 3,
      shootouts: 6,
    });
  });

  it('persists records under the versioned key', () => {
    const next = { ...EMPTY_RECORDS, wins: 1, shootouts: 1 };
    saveRecords(next);
    expect(window.localStorage.getItem(RECORDS_KEY)).toBeTruthy();
    expect(loadRecords()).toEqual(next);
  });

  it('returns empty records when the stored value is corrupt', () => {
    window.localStorage.setItem(RECORDS_KEY, '{not json');
    expect(loadRecords()).toEqual(EMPTY_RECORDS);
  });
});

describe('recordShootout', () => {
  it('tracks wins, losses and shootout count', () => {
    const win = recordShootout(EMPTY_RECORDS, { outcome: 'win', score: 360, saves: 2 });
    expect(win.records.wins).toBe(1);
    expect(win.records.bestScore).toBe(360);
    expect(win.records.bestSaves).toBe(2);
    expect(win.records.streak).toBe(1);
    expect(win.records.bestStreak).toBe(1);
    expect(win.records.shootouts).toBe(1);
    expect(win.isBest).toBe(true);

    const loss = recordShootout(win.records, { outcome: 'loss', score: 120, saves: 1 });
    expect(loss.records.losses).toBe(1);
    expect(loss.records.streak).toBe(0);
    expect(loss.records.bestStreak).toBe(1);
    expect(loss.records.bestScore).toBe(360);
    expect(loss.records.shootouts).toBe(2);
    expect(loss.isBest).toBe(false);
  });

  it('extends the streak and keeps a high-water mark', () => {
    const first = recordShootout(EMPTY_RECORDS, { outcome: 'win', score: 240, saves: 1 });
    const second = recordShootout(first.records, { outcome: 'win', score: 480, saves: 3 });
    expect(second.records.streak).toBe(2);
    expect(second.records.bestStreak).toBe(2);
    expect(second.records.bestScore).toBe(480);
    expect(second.records.bestSaves).toBe(3);
    expect(second.isBest).toBe(true);
  });

  it('does not treat an equal score as a new best', () => {
    const base = { ...EMPTY_RECORDS, bestScore: 240, bestSaves: 2 };
    const result = recordShootout(base, { outcome: 'win', score: 240, saves: 1 });
    expect(result.isBest).toBe(false);
  });
});

describe('penalty settings', () => {
  it('defaults to pro and unmuted', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.difficulty).toBe('pro');
    expect(DEFAULT_SETTINGS.muted).toBe(false);
  });

  it('rejects unknown difficulty and non-boolean mute', () => {
    expect(parseSettings({ version: 1, difficulty: 'godlike', muted: false })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ version: 1, difficulty: 'elite', muted: 'yes' })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ version: 0, difficulty: 'casual', muted: false })).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips valid settings', () => {
    const settings = { version: 1 as const, difficulty: 'elite' as const, muted: true };
    saveSettings(settings);
    expect(window.localStorage.getItem(SETTINGS_KEY)).toBeTruthy();
    expect(loadSettings()).toEqual(settings);
  });
});
