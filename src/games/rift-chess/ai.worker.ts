import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { AiLevel, AiMove } from './ai';

export interface EngineResult {
  move: AiMove | null;
  timedOut: boolean;
}

class EngineTimeout extends Error {}

const MATE_SCORE = 100_000;

const LEVELS: Record<AiLevel, { depth: number; randomChance: number }> = {
  novice: { depth: 1, randomChance: 0.55 },
  casual: { depth: 2, randomChance: 0.18 },
  club: { depth: 2, randomChance: 0 },
  expert: { depth: 3, randomChance: 0 },
  master: { depth: 4, randomChance: 0 },
};

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20_000,
};

function centralisation(fileIndex: number, rankIndex: number): number {
  const fileDistance = Math.abs(fileIndex - 3.5);
  const rankDistance = Math.abs(rankIndex - 3.5);
  return 7 - (fileDistance + rankDistance);
}

function positionalValue(type: PieceSymbol, color: 'w' | 'b', fileIndex: number, rankIndex: number): number {
  const centre = centralisation(fileIndex, rankIndex);
  const advancement = color === 'w' ? 7 - rankIndex : rankIndex;

  switch (type) {
    case 'p':
      return advancement * 5 + (fileIndex >= 2 && fileIndex <= 5 ? 4 : 0);
    case 'n':
      return centre * 14;
    case 'b':
      return centre * 6;
    case 'r':
      return advancement * 2;
    case 'q':
      return centre * 3;
    case 'k':
      return kingShelter(advancement) * 6;
  }
  return 0;
}

function kingShelter(advancement: number): number {
  return advancement <= 1 ? 1 : 0;
}

function evaluate(chess: Chess): number {
  let score = 0;
  const board = chess.board();

  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    const row = board[rankIndex];
    for (let fileIndex = 0; fileIndex < row.length; fileIndex += 1) {
      const piece = row[fileIndex];
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type] + positionalValue(piece.type, piece.color, fileIndex, rankIndex);
      score += piece.color === 'w' ? value : -value;
    }
  }

  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((left, right) => {
    const leftCapture = left.captured ? PIECE_VALUES[left.captured] : 0;
    const rightCapture = right.captured ? PIECE_VALUES[right.captured] : 0;
    const leftPromotion = left.promotion ? PIECE_VALUES[left.promotion] : 0;
    const rightPromotion = right.promotion ? PIECE_VALUES[right.promotion] : 0;
    return rightCapture + rightPromotion - (leftCapture + leftPromotion);
  });
}

function search(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  deadline: number,
): number {
  if (Date.now() > deadline) throw new EngineTimeout();
  if (chess.isCheckmate()) return -MATE_SCORE + ply;
  if (
    chess.isStalemate() ||
    chess.isInsufficientMaterial() ||
    chess.isThreefoldRepetition() ||
    chess.isDrawByFiftyMoves()
  ) {
    return 0;
  }
  if (depth === 0) {
    const perspective = chess.turn() === 'w' ? 1 : -1;
    return evaluate(chess) * perspective + chess.moves().length * 2;
  }

  let best = -Infinity;
  for (const move of orderMoves(chess.moves({ verbose: true }) as Move[])) {
    chess.move(move);
    const score = -search(chess, depth - 1, -beta, -alpha, ply + 1, deadline);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function toAiMove(move: Move): AiMove {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion as AiMove['promotion'],
  };
}

function randomMove(moves: Move[], random: () => number): Move {
  const index = Math.min(moves.length - 1, Math.floor(random() * moves.length));
  return moves[Math.max(0, index)];
}

export function chooseMove(
  fen: string,
  level: AiLevel,
  deadline: number = Date.now() + 9_000,
  random: () => number = Math.random,
): EngineResult {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true }) as Move[];
  if (legal.length === 0) return { move: null, timedOut: false };
  if (Date.now() > deadline) return { move: toAiMove(randomMove(legal, random)), timedOut: true };

  const config = LEVELS[level] ?? LEVELS.club;
  if (random() < config.randomChance) {
    return { move: toAiMove(randomMove(legal, random)), timedOut: false };
  }

  try {
    let bestScore = -Infinity;
    let best: Move[] = [];

    for (const move of orderMoves(legal)) {
      chess.move(move);
      const score = -search(chess, config.depth - 1, -Infinity, Infinity, 1, deadline);
      chess.undo();

      if (score > bestScore) {
        bestScore = score;
        best = [move];
      } else if (score === bestScore) {
        best.push(move);
      }
    }

    return { move: toAiMove(best[Math.floor(random() * best.length)] ?? legal[0]), timedOut: false };
  } catch (error) {
    if (error instanceof EngineTimeout) {
      return { move: toAiMove(randomMove(legal, random)), timedOut: true };
    }
    throw error;
  }
}

interface ThinkRequest {
  id: string;
  fen: string;
  level: AiLevel;
}

interface WorkerScope {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent<Partial<ThinkRequest>>) => void) | null;
}

const scope = typeof self !== 'undefined' ? (self as unknown as WorkerScope) : null;

if (scope) {
  scope.onmessage = (event) => {
    const data = event.data;
    if (!data || typeof data.id !== 'string' || typeof data.fen !== 'string') return;

    try {
      const result = chooseMove(data.fen, data.level ?? 'club');
      scope.postMessage({
        type: 'move',
        id: data.id,
        move: result.move,
        timedOut: result.timedOut,
      });
    } catch (error) {
      scope.postMessage({
        type: 'error',
        id: data.id,
        message: error instanceof Error ? error.message : 'Engine error',
      });
    }
  };
}
