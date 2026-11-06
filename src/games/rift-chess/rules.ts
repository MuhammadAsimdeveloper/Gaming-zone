import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export type OutcomeReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | 'fifty-move'
  | 'repetition';

export interface PieceView {
  square: Square;
  type: PieceSymbol;
  color: Color;
}

export interface MoveView {
  from: Square;
  to: Square;
  san: string;
  piece: PieceSymbol;
  color: Color;
  promotion?: PromotionPiece;
  captured?: PieceSymbol;
  isEnPassant: boolean;
  isCastle: boolean;
}

export interface OutcomeView {
  reason: OutcomeReason;
  winner: Color | null;
}

export interface PositionView {
  fen: string;
  turn: Color;
  pieces: PieceView[];
  legalMoves: MoveView[];
  checkedKing: Square | null;
  history: MoveView[];
  outcome: OutcomeView | null;
  inCheck: boolean;
}

function toMoveView(move: Move): MoveView {
  return {
    from: move.from,
    to: move.to,
    san: move.san,
    piece: move.piece,
    color: move.color,
    promotion: move.promotion as PromotionPiece | undefined,
    captured: move.captured,
    isEnPassant: move.isEnPassant(),
    isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
  };
}

function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

export class RiftChess {
  private chess: Chess;

  constructor(fen: string = START_FEN) {
    this.chess = new Chess(fen);
  }

  get fen(): string {
    return this.chess.fen();
  }

  turn(): Color {
    return this.chess.turn();
  }

  pieceAt(square: Square): PieceView | null {
    const piece = this.chess.get(square);
    return piece ? { square, type: piece.type, color: piece.color } : null;
  }

  legalTargets(square: Square): MoveView[] {
    try {
      return this.chess.moves({ square, verbose: true }).map(toMoveView);
    } catch {
      return [];
    }
  }

  move(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ): MoveView | null {
    const candidates = this.legalTargets(from).filter((move) => move.to === to);
    if (candidates.length === 0) return null;

    const needsPromotion = candidates.some((move) => move.promotion);
    if (needsPromotion && !promotion) return null;
    if (promotion && !candidates.some((move) => move.promotion === promotion)) return null;

    try {
      const applied = this.chess.move({ from, to, promotion });
      return applied ? toMoveView(applied) : null;
    } catch {
      return null;
    }
  }

  moveSan(san: string): MoveView | null {
    try {
      const applied = this.chess.move(san);
      return applied ? toMoveView(applied) : null;
    } catch {
      return null;
    }
  }

  undo(plies = 1): void {
    for (let index = 0; index < plies; index += 1) {
      if (!this.chess.undo()) return;
    }
  }

  history(): MoveView[] {
    return this.chess.history({ verbose: true }).map(toMoveView);
  }

  reset(): void {
    this.chess.reset();
  }

  load(fen: string): void {
    this.chess.load(fen);
  }

  outcome(): OutcomeView | null {
    if (this.chess.isCheckmate()) {
      return { reason: 'checkmate', winner: opposite(this.chess.turn()) };
    }
    if (this.chess.isStalemate()) return { reason: 'stalemate', winner: null };
    if (this.chess.isInsufficientMaterial()) {
      return { reason: 'insufficient-material', winner: null };
    }
    if (this.chess.isDrawByFiftyMoves()) return { reason: 'fifty-move', winner: null };
    if (this.chess.isThreefoldRepetition()) return { reason: 'repetition', winner: null };
    return null;
  }

  private checkedKing(): Square | null {
    if (!this.chess.inCheck()) return null;
    const color = this.chess.turn();
    for (const row of this.chess.board()) {
      for (const piece of row) {
        if (piece && piece.type === 'k' && piece.color === color) return piece.square;
      }
    }
    return null;
  }

  view(): PositionView {
    const pieces: PieceView[] = [];
    for (const row of this.chess.board()) {
      for (const piece of row) {
        if (piece) pieces.push({ square: piece.square, type: piece.type, color: piece.color });
      }
    }

    return {
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      pieces,
      legalMoves: this.chess.moves({ verbose: true }).map(toMoveView),
      checkedKing: this.checkedKing(),
      history: this.history(),
      outcome: this.outcome(),
      inCheck: this.chess.inCheck(),
    };
  }
}
