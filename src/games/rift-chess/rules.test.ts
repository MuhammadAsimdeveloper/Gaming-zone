import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  createGame,
  getBoardPieces,
  getLegalMoves,
  getPositionStatus,
  makeMove,
  undoMove,
} from './rules';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('Rift Chess rules adapter', () => {
  it('starts with the standard position and twenty legal moves', () => {
    const game = createGame();

    expect(game.fen()).toBe(START_FEN);
    expect(getLegalMoves(game)).toHaveLength(20);
    expect(getBoardPieces(game)).toHaveLength(32);
  });

  it('applies a legal move and returns its SAN and updated position', () => {
    const game = createGame();
    const move = makeMove(game, { from: 'e2', to: 'e4' });

    expect(move?.san).toBe('e4');
    expect(game.fen()).toContain(' b ');
    expect(getPositionStatus(game).turn).toBe('b');
  });

  it('rejects an illegal move without changing the position', () => {
    const game = createGame();
    const before = game.fen();

    expect(makeMove(game, { from: 'e2', to: 'e5' })).toBeNull();
    expect(game.fen()).toBe(before);
  });

  it('filters legal moves by source square', () => {
    const game = createGame();

    expect(getLegalMoves(game, 'e2').map((move) => move.to).sort()).toEqual(['e3', 'e4']);
  });

  it('undoes a move and restores the previous FEN', () => {
    const game = createGame();
    const before = game.fen();
    makeMove(game, { from: 'e2', to: 'e4' });

    expect(undoMove(game)?.san).toBe('e4');
    expect(game.fen()).toBe(before);
  });

  it('recognizes both castling moves when rights are available', () => {
    const game = createGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const moves = getLegalMoves(game, 'e1');

    expect(moves.some((move) => move.isKingsideCastle())).toBe(true);
    expect(moves.some((move) => move.isQueensideCastle())).toBe(true);
  });

  it('recognizes en passant as a legal capture', () => {
    const game = createGame('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    const move = getLegalMoves(game, 'e5').find((candidate) => candidate.isEnPassant());

    expect(move?.to).toBe('d6');
    expect(makeMove(game, { from: 'e5', to: 'd6' })?.isEnPassant()).toBe(true);
  });

  it('requires an explicit promotion piece and supports underpromotion', () => {
    const game = createGame('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const promotionMoves = getLegalMoves(game, 'a7');

    expect(promotionMoves.filter((move) => move.promotion)).toHaveLength(4);
    expect(makeMove(game, { from: 'a7', to: 'a8', promotion: 'n' })?.promotion).toBe('n');
  });

  it('reports checkmate as a decisive end state', () => {
    const game = createGame('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1');

    expect(getPositionStatus(game)).toMatchObject({ isGameOver: true, inCheck: true, reason: 'checkmate' });
  });

  it('reports stalemate as a draw with a specific reason', () => {
    const game = createGame('4k3/4P3/4K3/8/8/8/8/8 b - - 0 78');

    expect(getPositionStatus(game)).toMatchObject({ isGameOver: true, inCheck: false, reason: 'stalemate' });
  });

  it('reports insufficient material explicitly', () => {
    const game = createGame('4k3/8/8/8/8/8/8/4K3 w - - 0 1');

    expect(getPositionStatus(game).reason).toBe('insufficient-material');
  });

  it('reports the fifty-move rule explicitly', () => {
    const game = createGame('8/8/8/8/8/5k2/8/4K2R w - - 100 51');

    expect(getPositionStatus(game).reason).toBe('fifty-move');
  });

  it('tracks threefold repetition across a real move history', () => {
    const game = createGame();
    const cycle = [
      { from: 'g1', to: 'f3' }, { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' }, { from: 'f6', to: 'g8' },
    ] as const;

    for (const move of [...cycle, ...cycle]) makeMove(game, move);

    expect(getPositionStatus(game).reason).toBe('threefold-repetition');
  });

  it('round-trips thirty deterministic legal-position FEN fixtures', () => {
    const fixtures = Array.from({ length: 30 }, (_, index) => {
      const position = new Chess();
      for (let ply = 0; ply < index % 18; ply += 1) {
        const moves = position.moves({ verbose: true });
        if (moves.length === 0) break;
        const move = moves[(index * 7 + ply * 3) % moves.length]!;
        position.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
      }
      return position.fen();
    });

    for (const fen of fixtures) expect(createGame(fen).fen()).toBe(fen);
  });

  it('maps every occupied square to one board view model', () => {
    const pieces = getBoardPieces(createGame());

    expect(pieces).toHaveLength(32);
    expect(pieces).toContainEqual({ square: 'e1', color: 'w', type: 'k' });
    expect(pieces).toContainEqual({ square: 'e8', color: 'b', type: 'k' });
  });
});
