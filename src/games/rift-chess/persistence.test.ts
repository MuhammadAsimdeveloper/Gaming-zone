import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  clearSavedGame, createSaveSnapshot, loadGame, restoreSaveSnapshot, RIFT_CHESS_SAVE_KEY, saveGame,
  type SavedGameOptions, type StorageLike,
} from './persistence';

const options: SavedGameOptions = {
  mode: 'computer', playerColor: 'b', aiLevel: 3, orientation: 'b',
  startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
};

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

describe('Rift Chess local persistence', () => {
  it('round-trips the exact position and SAN history', () => {
    const game = new Chess();
    game.move('e4');
    game.move('c5');
    game.move('Nf3');
    const snapshot = createSaveSnapshot(game, options, new Date('2026-11-08T07:00:00.000Z'));
    const restored = restoreSaveSnapshot(snapshot);

    expect(restored?.game.fen()).toBe(game.fen());
    expect(restored?.game.history()).toEqual(game.history());
    expect(restored?.options).toEqual(options);
  });

  it('persists and resumes through a storage adapter', () => {
    const storage = memoryStorage();
    const game = new Chess();
    game.move('d4');

    expect(saveGame(storage, game, options)).toBe(true);
    expect(loadGame(storage)?.game.fen()).toBe(game.fen());
    expect(storage.getItem(RIFT_CHESS_SAVE_KEY)).not.toBeNull();
  });

  it('rejects unsupported versions, corrupt moves and mismatched FEN', () => {
    const game = new Chess();
    game.move('e4');
    const valid = createSaveSnapshot(game, options);
    expect(restoreSaveSnapshot({ ...valid, version: 99 })).toBeNull();
    expect(restoreSaveSnapshot({ ...valid, moves: [{ from: 'e2', to: 'e5' }] })).toBeNull();
    expect(restoreSaveSnapshot({ ...valid, fen: new Chess().fen() })).toBeNull();
  });

  it('rejects corrupted JSON in storage and can clear the save', () => {
    const storage = memoryStorage();
    storage.setItem(RIFT_CHESS_SAVE_KEY, '{broken');
    expect(loadGame(storage)).toBeNull();
    clearSavedGame(storage);
    expect(storage.getItem(RIFT_CHESS_SAVE_KEY)).toBeNull();
  });

  it('preserves non-standard starting positions across replay', () => {
    const startFen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
    const game = new Chess(startFen);
    game.move({ from: 'a7', to: 'a8', promotion: 'n' });
    const snapshot = createSaveSnapshot(game, { ...options, startFen });
    expect(restoreSaveSnapshot(snapshot)?.game.fen()).toBe(game.fen());
  });

  it('returns false rather than throwing when storage writes fail', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded'); },
    };
    expect(saveGame(storage, new Chess(), options)).toBe(false);
  });
});
