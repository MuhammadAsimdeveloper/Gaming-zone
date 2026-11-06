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
  recordGame,
  saveRecords,
  saveSettings,
} from './persistence';

beforeEach(() => {
  window.localStorage.clear();
});

describe('hoop circuit records', () => {
  it('falls back to empty records for missing or malformed data', () => {
    expect(loadRecords()).toEqual(EMPTY_RECORDS);
    window.localStorage.setItem(RECORDS_KEY, 'not-json');
    expect(loadRecords()).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ version: 2 })).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ ...EMPTY_RECORDS, bestScore: -5 })).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ ...EMPTY_RECORDS, games: 'many' })).toEqual(EMPTY_RECORDS);
  });

  it('floors fractional counters and keeps bestStreak at least streak', () => {
    const parsed = parseRecords({
      version: 1,
      bestScore: 41.9,
      bestStreak: 2,
      games: 3.7,
      makes: 12.2,
      shots: 20.8,
      streak: 5,
    });
    expect(parsed).toEqual({
      version: 1,
      bestScore: 41,
      bestStreak: 5,
      games: 3,
      makes: 12,
      shots: 20,
      streak: 5,
    });
  });

  it('round-trips records through browser storage', () => {
    saveRecords({ version: 1, bestScore: 33, bestStreak: 4, games: 2, makes: 18, shots: 25, streak: 0 });
    expect(loadRecords()).toEqual({
      version: 1,
      bestScore: 33,
      bestStreak: 4,
      games: 2,
      makes: 18,
      shots: 25,
      streak: 0,
    });
  });

  it('records a finished game and flags a new best score', () => {
    const first = recordGame(EMPTY_RECORDS, { score: 24, streak: 3, makes: 9, shots: 12 });
    expect(first.isBest).toBe(true);
    expect(first.records).toEqual({
      version: 1,
      bestScore: 24,
      bestStreak: 3,
      games: 1,
      makes: 9,
      shots: 12,
      streak: 3,
    });

    const second = recordGame(first.records, { score: 19, streak: 1, makes: 7, shots: 11 });
    expect(second.isBest).toBe(false);
    expect(second.records.bestScore).toBe(24);
    expect(second.records.bestStreak).toBe(3);
    expect(second.records.games).toBe(2);
    expect(second.records.makes).toBe(16);
    expect(second.records.shots).toBe(23);
    expect(second.records.streak).toBe(1);
  });

  it('accumulates shots and makes but treats an equal score as no record', () => {
    const records = { version: 1 as const, bestScore: 30, bestStreak: 2, games: 1, makes: 10, shots: 14, streak: 2 };
    const result = recordGame(records, { score: 30, streak: 2, makes: 10, shots: 14 });
    expect(result.isBest).toBe(false);
    expect(result.records.bestScore).toBe(30);
    expect(result.records.makes).toBe(20);
    expect(result.records.shots).toBe(28);
  });
});

describe('hoop circuit settings', () => {
  it('defaults to pro difficulty with sound on', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ version: 1, difficulty: 'pro', muted: false });
  });

  it('rejects unknown difficulty and non-boolean mute', () => {
    expect(parseSettings({ version: 1, difficulty: 'legend', muted: false })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ version: 1, difficulty: 'pro', muted: 'no' })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips settings through browser storage', () => {
    saveSettings({ version: 1, difficulty: 'allstar', muted: true });
    expect(window.localStorage.getItem(SETTINGS_KEY)).toContain('allstar');
    expect(loadSettings()).toEqual({ version: 1, difficulty: 'allstar', muted: true });
  });
});
