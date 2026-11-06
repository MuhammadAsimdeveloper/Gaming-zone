// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { START_FEN } from './rules';
import {
  PUZZLE_KEY,
  RECORDS_KEY,
  SAVE_KEY,
  clearGame,
  emptyRecords,
  loadGame,
  loadPuzzleProgress,
  loadRecords,
  recordResult,
  saveGame,
  savePuzzleProgress,
  type SavedGameV1,
} from './persistence';

function savedGame(overrides: Partial<SavedGameV1> = {}): SavedGameV1 {
  return {
    version: 1,
    mode: 'ai',
    fen: START_FEN,
    moves: [],
    playerColor: 'w',
    level: 'club',
    clocks: null,
    baseMinutes: null,
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('game save', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips a legal game', () => {
    expect(saveGame(savedGame({ mode: 'local', playerColor: null, level: null }))).toBe(true);

    const loaded = loadGame();
    expect(loaded?.mode).toBe('local');
    expect(loaded?.fen).toBe(START_FEN);
    expect(loaded?.moves).toEqual([]);
  });

  it('replays the move list before trusting the saved position', () => {
    expect(saveGame(savedGame({ moves: ['e4', 'e5'], fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' }))).toBe(true);

    const loaded = loadGame();
    expect(loaded?.moves).toEqual(['e4', 'e5']);
    expect(loaded?.fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  });

  it('discards a save whose FEN does not match its move list', () => {
    expect(saveGame(savedGame({ moves: ['e4'], fen: START_FEN }))).toBe(false);
    expect(loadGame()).toBeNull();
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('discards a save containing an illegal move', () => {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(savedGame({ moves: ['Qh5'], fen: START_FEN })),
    );
    expect(loadGame()).toBeNull();
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('resets cleanly on malformed JSON', () => {
    window.localStorage.setItem(SAVE_KEY, '{not json');
    expect(loadGame()).toBeNull();
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('resets cleanly on an unknown payload version', () => {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...savedGame(), version: 99 }));
    expect(loadGame()).toBeNull();
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('clears a saved game on request', () => {
    saveGame(savedGame());
    clearGame();
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => saveGame(savedGame())).not.toThrow();
    expect(loadGame()).toBeNull();
  });
});

describe('puzzle progress', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to nothing solved', () => {
    expect(loadPuzzleProgress()).toEqual({ version: 1, solved: [] });
  });

  it('round-trips solved puzzle ids without duplicates', () => {
    savePuzzleProgress({ version: 1, solved: ['p1', 'p2', 'p1'] });
    expect(loadPuzzleProgress().solved).toEqual(['p1', 'p2']);
    expect(window.localStorage.getItem(PUZZLE_KEY)).toBeTruthy();
  });

  it('ignores non-string entries and unknown versions', () => {
    window.localStorage.setItem(PUZZLE_KEY, JSON.stringify({ version: 1, solved: ['p1', 7, null] }));
    expect(loadPuzzleProgress().solved).toEqual(['p1']);

    window.localStorage.setItem(PUZZLE_KEY, JSON.stringify({ version: 4, solved: ['p2'] }));
    expect(loadPuzzleProgress().solved).toEqual([]);
  });
});

describe('records', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts every level at zero', () => {
    const records = emptyRecords();
    expect(records.version).toBe(1);
    expect(records.byLevel.novice).toEqual({ win: 0, loss: 0, draw: 0 });
    expect(records.byLevel.master).toEqual({ win: 0, loss: 0, draw: 0 });
  });

  it('increments only the matching level and outcome', () => {
    recordResult('club', 'win');
    recordResult('club', 'win');
    recordResult('club', 'loss');
    recordResult('expert', 'draw');

    const records = loadRecords();
    expect(records.byLevel.club).toEqual({ win: 2, loss: 1, draw: 0 });
    expect(records.byLevel.expert).toEqual({ win: 0, loss: 0, draw: 1 });
    expect(records.byLevel.novice).toEqual({ win: 0, loss: 0, draw: 0 });
  });

  it('returns the updated records from recordResult', () => {
    const records = recordResult('casual', 'draw');
    expect(records.byLevel.casual.draw).toBe(1);
  });

  it('resets records with an unknown version', () => {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 3, byLevel: {} }));
    expect(loadRecords()).toEqual(emptyRecords());
  });
});
