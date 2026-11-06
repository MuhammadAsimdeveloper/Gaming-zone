// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_RECORDS,
  GHOST_KEY_PREFIX,
  RECORDS_KEY,
  clearGhost,
  loadGhost,
  loadRecords,
  parseRecords,
  recordKey,
  recordTrial,
  saveGhost,
  saveRecords,
} from './persistence';
import type { GhostRecording } from './ghost';

const GHOST: GhostRecording = {
  version: 1,
  trackId: 'rift-loop',
  carId: 'rift-gt',
  time: 42.5,
  splits: [10, 20, 30, 35, 40, 42.5],
  samples: [
    { t: 0, x: 0, z: 0, heading: 0, speed: 0 },
    { t: 0.05, x: 1, z: 2, heading: 0.1, speed: 14 },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('time trial records', () => {
  it('starts empty and round-trips through local storage', () => {
    expect(loadRecords()).toEqual(EMPTY_RECORDS);

    const { records } = recordTrial(
      EMPTY_RECORDS,
      { trackId: 'rift-loop', carId: 'rift-gt', time: 42.5, splits: [10, 20, 30, 35, 40, 42.5], medal: 'gold' },
      new Date('2026-11-06T12:00:00.000Z'),
    );
    saveRecords(records);
    const loaded = loadRecords();
    expect(loaded.runs).toBe(1);
    expect(loaded.best['rift-loop:rift-gt']).toEqual({
      time: 42.5,
      medal: 'gold',
      splits: [10, 20, 30, 35, 40, 42.5],
      setAt: '2026-11-06T12:00:00.000Z',
    });
  });

  it('records only a faster personal best but counts every run', () => {
    const input = {
      trackId: 'rift-loop' as const,
      carId: 'rift-gt' as const,
      splits: [10, 20, 30],
    };
    const first = recordTrial(EMPTY_RECORDS, { ...input, time: 50, medal: 'silver' });
    expect(first.isBest).toBe(true);

    const slower = recordTrial(first.records, { ...input, time: 51, medal: 'bronze' });
    expect(slower.isBest).toBe(false);
    expect(slower.records.runs).toBe(2);
    expect(slower.records.best['rift-loop:rift-gt']?.time).toBe(50);
    expect(slower.records.best['rift-loop:rift-gt']?.medal).toBe('silver');

    const faster = recordTrial(slower.records, { ...input, time: 40, medal: 'gold' });
    expect(faster.isBest).toBe(true);
    expect(faster.records.best['rift-loop:rift-gt']?.time).toBe(40);
    expect(faster.records.best['rift-loop:rift-gt']?.medal).toBe('gold');
  });

  it('keeps personal bests separate per track and car', () => {
    const first = recordTrial(EMPTY_RECORDS, {
      trackId: 'rift-loop',
      carId: 'rift-gt',
      time: 40,
      splits: [],
      medal: 'gold',
    });
    const second = recordTrial(first.records, {
      trackId: 'glass-cut',
      carId: 'vanta-rs',
      time: 55,
      splits: [],
      medal: 'bronze',
    });
    expect(Object.keys(second.records.best).sort()).toEqual(['glass-cut:vanta-rs', 'rift-loop:rift-gt']);
    expect(recordKey('glass-cut', 'vanta-rs')).toBe('glass-cut:vanta-rs');
  });

  it('rejects malformed stored records', () => {
    expect(parseRecords(null)).toEqual(EMPTY_RECORDS);
    expect(parseRecords({ version: 2, best: {}, runs: 3 })).toEqual(EMPTY_RECORDS);
    expect(
      parseRecords({
        version: 1,
        runs: -2,
        best: {
          'rift-loop:rift-gt': { time: 'fast', medal: 'gold', splits: [], setAt: 'now' },
          'glass-cut:rift-gt': { time: 12, medal: 'platinum', splits: [], setAt: 'now' },
          'terminal-spiral:rift-gt': { time: 30, medal: 'silver', splits: [1, 2], setAt: 'now' },
        },
      }),
    ).toEqual({
      version: 1,
      runs: 0,
      best: {
        'terminal-spiral:rift-gt': {
          time: 30,
          medal: 'silver',
          splits: [1, 2],
          setAt: 'now',
        },
      },
    });

    window.localStorage.setItem(RECORDS_KEY, '{not json');
    expect(loadRecords()).toEqual(EMPTY_RECORDS);
  });
});

describe('time trial ghosts', () => {
  it('stores and reloads a ghost per track and car', () => {
    expect(loadGhost('rift-loop', 'rift-gt')).toBeNull();
    saveGhost(GHOST);
    expect(loadGhost('rift-loop', 'rift-gt')).toEqual(GHOST);
    expect(loadGhost('glass-cut', 'rift-gt')).toBeNull();
    expect(window.localStorage.getItem(GHOST_KEY_PREFIX + 'rift-loop:rift-gt')).not.toBeNull();
  });

  it('clears a stored ghost', () => {
    saveGhost(GHOST);
    clearGhost('rift-loop', 'rift-gt');
    expect(loadGhost('rift-loop', 'rift-gt')).toBeNull();
  });

  it('ignores malformed ghost data', () => {
    window.localStorage.setItem(GHOST_KEY_PREFIX + 'rift-loop:rift-gt', '{"version":1}');
    expect(loadGhost('rift-loop', 'rift-gt')).toBeNull();
  });
});
