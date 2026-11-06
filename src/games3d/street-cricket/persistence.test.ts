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
  recordMatch,
  saveRecords,
  saveSettings,
} from './persistence';

beforeEach(() => {
  window.localStorage.clear();
});

describe('street cricket records', () => {
  it('falls back to empty records for missing or malformed data', () => {
    expect(loadRecords()).toEqual(EMPTY_RECORDS);
    window.localStorage.setItem(RECORDS_KEY, 'not-json');
    expect(loadRecords()).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ version: 2 })).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ ...EMPTY_RECORDS, games: -1 })).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ ...EMPTY_RECORDS, sixes: 'lots' })).toEqual(EMPTY_RECORDS);
  });

  it('floors fractional counters', () => {
    const parsed = parseRecords({
      version: 1,
      games: 3.8,
      wins: 2.2,
      bestSuperOver: 14.9,
      bestChase: 51.4,
      bestNets: 22.1,
      sixes: 4.6,
      fours: 7.9,
    });
    expect(parsed).toEqual({
      version: 1,
      games: 3,
      wins: 2,
      bestSuperOver: 14,
      bestChase: 51,
      bestNets: 22,
      sixes: 4,
      fours: 7,
    });
  });

  it('tracks a new best only when the format score improves', () => {
    const first = recordMatch(EMPTY_RECORDS, {
      format: 'super-over',
      runs: 12,
      outcome: 'win',
      sixes: 1,
      fours: 2,
    });
    expect(first.isBest).toBe(true);
    expect(first.records.bestSuperOver).toBe(12);
    expect(first.records.wins).toBe(1);
    expect(first.records.games).toBe(1);

    const second = recordMatch(first.records, {
      format: 'super-over',
      runs: 9,
      outcome: 'loss',
      sixes: 0,
      fours: 1,
    });
    expect(second.isBest).toBe(false);
    expect(second.records.bestSuperOver).toBe(12);
    expect(second.records.games).toBe(2);
    expect(second.records.wins).toBe(1);
    expect(second.records.sixes).toBe(1);
    expect(second.records.fours).toBe(3);
  });

  it('keeps a separate best for each format', () => {
    const chase = recordMatch(EMPTY_RECORDS, {
      format: 'rooftop-chase',
      runs: 58,
      outcome: 'win',
      sixes: 3,
      fours: 4,
    });
    expect(chase.records.bestChase).toBe(58);
    expect(chase.records.bestSuperOver).toBe(0);
  });

  it('round-trips records through browser storage', () => {
    const records = {
      ...EMPTY_RECORDS,
      games: 4,
      wins: 3,
      bestSuperOver: 18,
      bestChase: 61,
      bestNets: 24,
      sixes: 9,
      fours: 14,
    };
    saveRecords(records);
    expect(loadRecords()).toEqual(records);
  });
});

describe('street cricket settings', () => {
  it('defaults to a super over on Harbour Row', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.format).toBe('super-over');
    expect(DEFAULT_SETTINGS.districtId).toBe('harbour-row');
  });

  it('rejects unknown formats and districts', () => {
    expect(parseSettings({ version: 1, format: 'test-match', districtId: 'harbour-row', muted: false })).toEqual(
      DEFAULT_SETTINGS,
    );
    expect(parseSettings({ version: 1, format: 'nets', districtId: 'unknown', muted: false })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('round-trips valid settings', () => {
    const settings = { version: 1 as const, format: 'rooftop-chase' as const, districtId: 'tidewalk', muted: true };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
    window.localStorage.removeItem(SETTINGS_KEY);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
