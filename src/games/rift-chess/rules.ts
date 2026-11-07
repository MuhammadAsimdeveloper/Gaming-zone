import { Chess, DEFAULT_POSITION } from 'chess.js';
import type { Color, Move, Piece, PieceSymbol, Square } from 'chess.js';

export type PromotionPiece = Exclude<PieceSymbol, 'k' | 'p'>;

export interface ChessMoveInput {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

export interface BoardPiece {
  square: Square;
  color: Color;
  type: PieceSymbol;
}

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | 'fifty-move'
  | 'threefold-repetition'
  | 'draw';

export interface PositionStatus {
  turn: Color;
  inCheck: boolean;
  isGameOver: boolean;
  reason: EndReason | null;
}

/** Create the single authoritative rules state for one game. */
export function createGame(fen = DEFAULT_POSITION): Chess {
  return new Chess(fen);
}

/** Return legal moves, optionally scoped to one source square. */
export function getLegalMoves(game: Chess, square?: Square): Move[] {
  return square
    ? game.moves({ square, verbose: true })
    : game.moves({ verbose: true });
}

/** Apply a legal move. Illegal or incomplete moves leave the position unchanged. */
export function makeMove(game: Chess, input: ChessMoveInput): Move | null {
  try {
    return game.move(input);
  } catch {
    return null;
  }
}

/** Undo one ply; returns null when there is no move to undo. */
export function undoMove(game: Chess): Move | null {
  return game.undo();
}

/** Produce a plain board view model; React does not maintain a second rules board. */
export function getBoardPieces(game: Chess): BoardPiece[] {
  const files = 'abcdefgh';
  return game.board().flatMap((row, rankIndex) =>
    row.flatMap((piece: Piece | null, fileIndex) =>
      piece
        ? [{
            square: `${files[fileIndex]}${8 - rankIndex}` as Square,
            color: piece.color,
            type: piece.type,
          }]
        : [],
    ),
  );
}

/** Resolve end states in the product's documented precedence order. */
export function getPositionStatus(game: Chess): PositionStatus {
  let reason: EndReason | null = null;

  if (game.isCheckmate()) reason = 'checkmate';
  else if (game.isStalemate()) reason = 'stalemate';
  else if (game.isInsufficientMaterial()) reason = 'insufficient-material';
  else if (game.isDrawByFiftyMoves()) reason = 'fifty-move';
  else if (game.isThreefoldRepetition()) reason = 'threefold-repetition';
  else if (game.isDraw()) reason = 'draw';

  return {
    turn: game.turn(),
    inCheck: game.isCheck(),
    isGameOver: game.isGameOver(),
    reason,
  };
}
