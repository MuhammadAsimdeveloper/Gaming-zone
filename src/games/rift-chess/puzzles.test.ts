import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleById, puzzleMoves } from './puzzles';
import { RiftChess } from './rules';

function mateAfter(game: Chess, san: string): boolean {
  game.move(san);
  const mate = game.isCheckmate();
  game.undo();
  return mate;
}

describe('puzzle set', () => {
  it('ships exactly 40 puzzles with unique ids', () => {
    expect(PUZZLES).toHaveLength(40);
    expect(new Set(PUZZLES.map((puzzle) => puzzle.id)).size).toBe(40);
  });

  it('starts every puzzle with White to move and no check', () => {
    for (const puzzle of PUZZLES) {
      const game = new Chess(puzzle.fen);
      expect(game.turn(), puzzle.id).toBe('w');
      expect(game.inCheck(), puzzle.id).toBe(false);
    }
  });

  it('has a legal solution line for every puzzle', () => {
    for (const puzzle of PUZZLES) {
      const game = new RiftChess(puzzle.fen);
      for (const san of puzzle.solution) {
        expect(game.moveSan(san), `${puzzle.id} ${san}`).not.toBeNull();
      }
      expect(game.outcome()?.reason, puzzle.id).toBe('checkmate');
    }
  });

  it('uses the stated number of player moves', () => {
    for (const puzzle of PUZZLES) {
      const playerMoves = puzzle.solution.filter((_, index) => index % 2 === 0);
      expect(playerMoves.length, puzzle.id).toBe(puzzle.mateIn);
    }
  });

  it('has no immediate mate in the mate-in-two set', () => {
    for (const puzzle of PUZZLES) {
      if (puzzle.mateIn !== 2) continue;
      const game = new Chess(puzzle.fen);
      const mates = game.moves().filter((san) => mateAfter(game, san));
      expect(mates, puzzle.id).toEqual([]);
    }
  });

  it('forces mate against every black reply after the key move', () => {
    for (const puzzle of PUZZLES) {
      if (puzzle.mateIn !== 2) continue;
      const game = new Chess(puzzle.fen);
      game.move(puzzle.solution[0]);

      const replies = game.moves();
      expect(replies.length, puzzle.id).toBeGreaterThan(0);

      for (const reply of replies) {
        game.move(reply);
        const whiteMoves = game.moves();
        const mating = whiteMoves.filter((san) => mateAfter(game, san));
        expect(mating.length, `${puzzle.id} after ${reply}`).toBeGreaterThan(0);
        game.undo();
      }
    }
  });

  it('resolves solution SAN to exact from/to squares', () => {
    const puzzle = puzzleById('p01');
    expect(puzzle).not.toBeNull();
    if (!puzzle) return;

    const moves = puzzleMoves(puzzle);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: 'f2', to: 'f8', san: 'Rf8#' });
  });

  it('returns null for unknown puzzle ids', () => {
    expect(puzzleById('nope')).toBeNull();
  });
});
