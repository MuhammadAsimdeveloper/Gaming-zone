import { Chess } from 'chess.js';
import type { Move, PieceSymbol, Square } from 'chess.js';

export type AiLevel = 1 | 2 | 3 | 4 | 5;
export interface AiMove { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }
export interface AiSearchOptions { level?: AiLevel; timeBudgetMs?: number }
export interface AiWorkerRequest { requestId: number; fen: string; level: AiLevel }
export interface AiWorkerResponse { requestId: number; fen: string; move: AiMove | null; error?: string }

const VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20_000 };
const MATE = 100_000;
const DEPTH: Record<AiLevel, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };
const BUDGET: Record<AiLevel, number> = { 1: 90, 2: 180, 3: 350, 4: 600, 5: 850 };

class SearchTimeout extends Error {
  constructor() { super('AI search time budget reached'); }
}

function evaluateWhite(game: Chess): number {
  let score = 0;
  const board = game.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece) continue;
      const sign = piece.color === 'w' ? 1 : -1;
      score += sign * VALUE[piece.type];
      const center = Math.abs(file - 3.5) + Math.abs(rank - 3.5);
      if (piece.type === 'n') score += sign * Math.round((7 - center) * 9);
      if (piece.type === 'b') score += sign * Math.round((7 - center) * 4);
      if (piece.type === 'p') score += sign * (piece.color === 'w' ? 6 - rank : rank - 1) * 5;
    }
  }
  return score;
}

function evaluateTurn(game: Chess): number {
  const score = evaluateWhite(game);
  return game.turn() === 'w' ? score : -score;
}

function orderValue(move: Move): number {
  return (move.captured ? VALUE[move.captured] * 10 : 0)
    - VALUE[move.piece]
    + (move.promotion ? VALUE[move.promotion] * 2 : 0);
}

function orderedMoves(game: Chess): Move[] {
  return game.moves({ verbose: true }).sort((a, b) => orderValue(b) - orderValue(a));
}

function negamax(game: Chess, depth: number, alpha: number, beta: number, ply: number, deadline: number): number {
  if (Date.now() >= deadline) throw new SearchTimeout();
  if (game.isCheckmate()) return -MATE + ply;
  if (game.isDraw()) return 0;
  if (depth === 0) return evaluateTurn(game);

  let best = -Infinity;
  for (const move of orderedMoves(game)) {
    game.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
    let score: number;
    try {
      score = -negamax(game, depth - 1, -beta, -alpha, ply + 1, deadline);
    } finally {
      game.undo();
    }
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best === -Infinity ? evaluateTurn(game) : best;
}

/** Small deterministic alpha-beta opponent. Run from a Web Worker in the UI. */
export function findBestMove(fen: string, options: AiSearchOptions = {}): AiMove | null {
  const level = options.level ?? 2;
  const game = new Chess(fen);
  if (game.isGameOver()) return null;

  const moves = orderedMoves(game);
  if (moves.length === 0) return null;
  let best = moves[0]!;
  const deadline = Date.now() + Math.max(25, options.timeBudgetMs ?? BUDGET[level]);

  for (let depth = 1; depth <= DEPTH[level]; depth += 1) {
    let roundBest = best;
    let roundScore = -Infinity;
    let complete = true;

    for (const move of moves) {
      try {
        if (Date.now() >= deadline) throw new SearchTimeout();
        game.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
        let score: number;
        try {
          score = -negamax(game, depth - 1, -Infinity, Infinity, 1, deadline);
        } finally {
          game.undo();
        }
        if (score > roundScore) { roundScore = score; roundBest = move; }
      } catch (error) {
        if (!(error instanceof SearchTimeout)) throw error;
        complete = false;
        break;
      }
    }

    if (!complete) break;
    best = roundBest;
    moves.sort((a, b) => a === best ? -1 : b === best ? 1 : orderValue(b) - orderValue(a));
  }

  return { from: best.from, to: best.to, ...(best.promotion ? { promotion: best.promotion as NonNullable<AiMove['promotion']> } : {}) };
}

export const AI_LEVEL_LABELS: Record<AiLevel, string> = {
  1: 'Novice', 2: 'Casual', 3: 'Club', 4: 'Expert', 5: 'Master',
};
