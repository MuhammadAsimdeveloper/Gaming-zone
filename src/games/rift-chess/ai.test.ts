import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { findBestMove, type AiLevel } from './ai';

describe('Rift Chess computer opponent', () => {
  it.each([1, 2, 3, 4, 5] as AiLevel[])('returns a legal move at level %s', (level) => {
    const game = new Chess();
    const move = findBestMove(game.fen(), { level, timeBudgetMs: 80 });
    expect(move).not.toBeNull();
    expect(game.move(move!).san).toBeTruthy();
  });

  it('finds a legal reply for Black', () => {
    const game = new Chess();
    game.move('e4');
    const move = findBestMove(game.fen(), { level: 1, timeBudgetMs: 60 });
    expect(game.move(move!)?.color).toBe('b');
  });

  it('returns null for a terminal position', () => {
    const game = new Chess('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1');
    expect(findBestMove(game.fen())).toBeNull();
  });

  it('uses a legal fallback when the requested time budget is tiny', () => {
    const game = new Chess();
    const move = findBestMove(game.fen(), { level: 5, timeBudgetMs: 1 });
    expect(move).not.toBeNull();
    expect(game.moves()).toContain(game.move(move!)?.san);
  });
});
