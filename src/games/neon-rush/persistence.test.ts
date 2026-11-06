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
  recordRun,
  saveRecords,
  saveSettings,
} from './persistence';

beforeEach(() => {
  window.localStorage.clear();
});

describe('records', () => {
  it('falls back to empty records when nothing is stored', () => {
    expect(loadRecords()).toEqual(EMPTY_RECORDS);
  });

  it('round-trips saved records', () => {
    const records = { ...EMPTY_RECORDS, bestScore: 4200, bestDistance: 912, bestShards: 34, runs: 7 };
    saveRecords(records);
    expect(loadRecords()).toEqual(records);
    expect(JSON.parse(window.localStorage.getItem(RECORDS_KEY) ?? '')).toMatchObject({ version: 1 });
  });

  it('rejects malformed or negative values', () => {
    expect(parseRecords(null)).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ version: 2, bestScore: 10 })).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ version: 1, bestScore: -5, bestDistance: Number.NaN })).toEqual(EMPTY_RECORDS);
    window.localStorage.setItem(RECORDS_KEY, '{not json');
    expect(loadRecords()).toEqual(EMPTY_RECORDS);
  });

  it('keeps the highest score and distance while counting every run', () => {
    const first = recordRun(EMPTY_RECORDS, { score: 1200, distance: 480, shards: 21 });
    expect(first.isBest).toBe(true);
    expect(first.records).toMatchObject({ bestScore: 1200, bestDistance: 480, bestShards: 21, runs: 1 });

    const weaker = recordRun(first.records, { score: 900, distance: 500, shards: 12 });
    expect(weaker.isBest).toBe(false);
    expect(weaker.records).toMatchObject({ bestScore: 1200, bestDistance: 500, bestShards: 21, runs: 2 });

    const stronger = recordRun(weaker.records, { score: 1500, distance: 300, shards: 40 });
    expect(stronger.isBest).toBe(true);
    expect(stronger.records).toMatchObject({ bestScore: 1500, bestDistance: 500, bestShards: 40, runs: 3 });
  });
});

describe('settings', () => {
  it('defaults to balanced quality with sound on', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips quality and mute, rejecting unknown presets', () => {
    saveSettings({ version: 1, quality: 'performance', muted: true });
    expect(loadSettings()).toEqual({ version: 1, quality: 'performance', muted: true });

    expect(parseSettings({ version: 1, quality: 'ultra', muted: false })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ version: 1, quality: 'high', muted: 'yes' })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('persists settings under its own versioned key', () => {
    saveSettings({ version: 1, quality: 'high', muted: false });
    expect(window.localStorage.getItem(SETTINGS_KEY)).toContain('"high"');
  });
});
