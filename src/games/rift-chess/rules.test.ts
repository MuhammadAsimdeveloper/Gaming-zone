import { describe, expect, it } from 'vitest';
import { RiftChess, START_FEN } from './rules';

const CASTLE_FEN = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';

function played(moves: string[]): RiftChess {
  const position = new RiftChess();
  for (const san of moves) {
    const applied = position.moveSan(san);
    if (!applied) throw new Error(`Fixture move ${san} was rejected`);
  }
  return position;
}

function perft(fen: string, depth: number): number {
  if (depth === 0) return 1;
  const position = new RiftChess(fen);
  let nodes = 0;
  for (const move of position.view().legalMoves) {
    const child = new RiftChess(position.fen);
    if (!child.move(move.from, move.to, move.promotion)) {
      throw new Error(`Legal move ${move.san} was rejected`);
    }
    nodes += perft(child.fen, depth - 1);
  }
  return nodes;
}

describe('RiftChess legal move generation', () => {
  it('offers the twenty opening moves and White to move', () => {
    const position = new RiftChess();
    expect(position.turn()).toBe('w');
    expect(position.view().legalMoves).toHaveLength(20);
    expect(position.fen).toBe(START_FEN);
  });

  it('matches the published perft counts for the first two plies', () => {
    expect(perft(START_FEN, 1)).toBe(20);
    expect(perft(START_FEN, 2)).toBe(400);
  });

  it('reports SAN and flags for a double pawn push', () => {
    const position = new RiftChess();
    const e4 = position.view().legalMoves.find((move) => move.san === 'e4');
    expect(e4).toMatchObject({ from: 'e2', to: 'e4', isEnPassant: false, isCastle: false });
  });

  it('lists both knight targets from the opening square', () => {
    const position = new RiftChess();
    const targets = position
      .legalTargets('b1')
      .map((move) => move.to)
      .sort();
    expect(targets).toEqual(['a3', 'c3']);
  });

  it('does not list a pawn push blocked by a piece', () => {
    const position = new RiftChess('4k3/8/8/8/8/4N3/4P3/4K3 w - - 0 1');
    expect(position.legalTargets('e2')).toHaveLength(0);
  });

  it('rejects an illegal move and leaves the position untouched', () => {
    const position = new RiftChess();
    expect(position.move('e2', 'e5')).toBeNull();
    expect(position.fen).toBe(START_FEN);
    expect(position.view().history).toHaveLength(0);
  });

  it('rejects moving the opponent pawn', () => {
    const position = new RiftChess();
    expect(position.legalTargets('e7')).toHaveLength(0);
    expect(position.move('e7', 'e5')).toBeNull();
  });

  it('keeps a pinned knight on its square', () => {
    const position = new RiftChess('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1');
    expect(position.legalTargets('e2')).toHaveLength(0);
  });
});

describe('RiftChess check and end states', () => {
  it('detects check and identifies the checked king', () => {
    const position = new RiftChess('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1');
    expect(position.view().inCheck).toBe(true);
    expect(position.view().checkedKing).toBe('e8');
    expect(position.view().outcome).toBeNull();
  });

  it('reports no checked king when the side to move is safe', () => {
    const position = new RiftChess();
    expect(position.view().inCheck).toBe(false);
    expect(position.view().checkedKing).toBeNull();
  });

  it("detects Fool's mate with an exact reason and winner", () => {
    const position = played(['f3', 'e5', 'g4', 'Qh4#']);
    expect(position.outcome()).toEqual({ reason: 'checkmate', winner: 'b' });
    expect(position.view().outcome?.reason).toBe('checkmate');
  });

  it("detects Scholar's mate with an exact reason and winner", () => {
    const position = played(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']);
    expect(position.outcome()).toEqual({ reason: 'checkmate', winner: 'w' });
  });

  it('reports stalemate rather than a generic draw', () => {
    const position = new RiftChess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(position.outcome()).toEqual({ reason: 'stalemate', winner: null });
    expect(position.view().checkedKing).toBeNull();
  });

  it('treats king versus king as insufficient material', () => {
    const position = new RiftChess('8/8/8/4k3/8/8/8/4K3 w - - 0 1');
    expect(position.outcome()).toEqual({ reason: 'insufficient-material', winner: null });
  });

  it('treats king and bishop versus king as insufficient material', () => {
    const position = new RiftChess('8/8/8/4k3/8/8/8/3BK3 w - - 0 1');
    expect(position.outcome()?.reason).toBe('insufficient-material');
  });

  it('treats king and knight versus king as insufficient material', () => {
    const position = new RiftChess('8/8/8/4k3/8/8/8/3NK3 w - - 0 1');
    expect(position.outcome()?.reason).toBe('insufficient-material');
  });

  it('treats bishops on the same colour as insufficient material', () => {
    const position = new RiftChess('8/8/8/3bk3/8/8/8/3BK3 w - - 0 1');
    expect(position.outcome()?.reason).toBe('insufficient-material');
  });

  it('does not call a rook ending materially insufficient', () => {
    const position = new RiftChess('8/8/8/4k3/8/8/8/R3K3 w - - 0 1');
    expect(position.outcome()).toBeNull();
  });

  it('reports the fifty-move rule at the hundredth halfmove', () => {
    const position = new RiftChess('8/8/8/4k3/8/8/8/R3K3 w - - 100 80');
    expect(position.outcome()).toEqual({ reason: 'fifty-move', winner: null });
  });

  it('reports threefold repetition for the shuffled knights', () => {
    const position = played(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']);
    expect(position.outcome()).toEqual({ reason: 'repetition', winner: null });
  });

  it('gives checkmate precedence over the fifty-move counter', () => {
    const position = new RiftChess('7k/6Q1/6K1/8/8/8/8/8 b - - 100 80');
    expect(position.outcome()).toEqual({ reason: 'checkmate', winner: 'w' });
  });

  it('reports no outcome while the game is playable', () => {
    expect(new RiftChess().outcome()).toBeNull();
  });
});

describe('RiftChess special moves', () => {
  it('allows kingside castling when the path is clear', () => {
    const position = new RiftChess(CASTLE_FEN);
    const castle = position.legalTargets('e1').find((move) => move.to === 'g1');
    expect(castle?.isCastle).toBe(true);
    expect(position.move('e1', 'g1')).toMatchObject({ san: 'O-O', isCastle: true });
    expect(position.pieceAt('g1')).toMatchObject({ type: 'k', color: 'w' });
    expect(position.pieceAt('f1')).toMatchObject({ type: 'r', color: 'w' });
  });

  it('blocks castling on a side where a piece stands in the way', () => {
    const position = new RiftChess('r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1');
    const targets = position.legalTargets('e1');
    expect(targets.some((move) => move.to === 'g1')).toBe(false);
    expect(targets.some((move) => move.to === 'c1')).toBe(true);
  });

  it('removes castling rights after the king moves', () => {
    const position = new RiftChess(CASTLE_FEN);
    position.move('e1', 'e2');
    position.move('e8', 'e7');
    position.move('e2', 'e1');
    position.move('e7', 'e8');
    expect(position.legalTargets('e1').some((move) => move.isCastle)).toBe(false);
  });

  it('removes castling rights after the rook moves', () => {
    const position = new RiftChess(CASTLE_FEN);
    position.move('h1', 'h2');
    position.move('a7', 'a6');
    position.move('h2', 'h1');
    position.move('a6', 'a5');
    expect(position.legalTargets('e1').some((move) => move.to === 'g1')).toBe(false);
  });

  it('offers en passant immediately after a double pawn push', () => {
    const position = played(['e4', 'a6', 'e5', 'd5']);
    const capture = position.legalTargets('e5').find((move) => move.to === 'd6');
    expect(capture?.isEnPassant).toBe(true);
    expect(capture?.san).toBe('exd6');
  });

  it('removes the bypassed pawn when en passant is played', () => {
    const position = played(['e4', 'a6', 'e5', 'd5']);
    expect(position.move('e5', 'd6', undefined)).toMatchObject({ isEnPassant: true });
    expect(position.pieceAt('d5')).toBeNull();
    expect(position.pieceAt('d6')).toMatchObject({ type: 'p', color: 'w' });
  });

  it('expires the en passant window after one ply', () => {
    const position = played(['e4', 'a6', 'e5', 'd5', 'Nf3', 'a5']);
    expect(position.legalTargets('e5').some((move) => move.isEnPassant)).toBe(false);
  });

  it('requires an explicit promotion choice', () => {
    const position = new RiftChess('8/P7/8/8/8/8/8/K6k w - - 0 1');
    const options = position.legalTargets('a7').filter((move) => move.to === 'a8');
    expect(options.map((move) => move.promotion).sort()).toEqual(['b', 'n', 'q', 'r']);
    expect(position.move('a7', 'a8')).toBeNull();
  });

  it('creates the chosen promotion piece', () => {
    const position = new RiftChess('8/P7/8/8/8/8/8/K6k w - - 0 1');
    expect(position.move('a7', 'a8', 'n')).toMatchObject({ promotion: 'n' });
    expect(position.pieceAt('a8')).toMatchObject({ type: 'n', color: 'w' });
  });

  it('promotes to a queen when chosen', () => {
    const position = new RiftChess('8/P7/8/8/8/8/8/K6k w - - 0 1');
    expect(position.move('a7', 'a8', 'q')).toMatchObject({ promotion: 'q' });
    expect(position.pieceAt('a8')).toMatchObject({ type: 'q', color: 'w' });
  });
});

describe('RiftChess undo, history and reset', () => {
  it('undoes a move and restores the FEN and turn', () => {
    const position = new RiftChess();
    const before = position.fen;
    position.move('e2', 'e4');
    expect(position.turn()).toBe('b');
    position.undo();
    expect(position.fen).toBe(before);
    expect(position.turn()).toBe('w');
  });

  it('restores castling rights after undo', () => {
    const position = new RiftChess(CASTLE_FEN);
    position.move('e1', 'g1');
    position.undo();
    expect(position.legalTargets('e1').some((move) => move.to === 'g1')).toBe(true);
  });

  it('restores the en passant target after undo', () => {
    const position = played(['e4', 'a6', 'e5', 'd5']);
    const targetBefore = position.fen.split(' ')[3];
    position.move('e5', 'd6');
    position.undo();
    expect(position.fen.split(' ')[3]).toBe(targetBefore);
    expect(position.pieceAt('d5')).toMatchObject({ type: 'p', color: 'b' });
  });

  it('undoes multiple plies at once', () => {
    const position = played(['e4', 'e5', 'Nf3']);
    position.undo(3);
    expect(position.fen).toBe(START_FEN);
    expect(position.history()).toHaveLength(0);
  });

  it('returns SAN history in order', () => {
    const position = played(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(position.history().map((move) => move.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('resets to the starting position and clears history', () => {
    const position = played(['e4', 'e5']);
    position.reset();
    expect(position.fen).toBe(START_FEN);
    expect(position.history()).toHaveLength(0);
    expect(position.view().legalMoves).toHaveLength(20);
  });

  it('loads a custom free-board position', () => {
    const position = new RiftChess('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(position.turn()).toBe('w');
    expect(position.pieceAt('e2')).toMatchObject({ type: 'p', color: 'w' });
    expect(position.view().legalMoves).toHaveLength(6);
  });

  it('rejects an invalid FEN', () => {
    expect(() => new RiftChess('this is not a fen')).toThrow();
  });
});

describe('RiftChess position view', () => {
  it('lists thirty-two starting pieces with correct squares', () => {
    const view = new RiftChess().view();
    expect(view.pieces).toHaveLength(32);
    expect(view.pieces).toContainEqual({ square: 'e1', type: 'k', color: 'w' });
    expect(view.pieces).toContainEqual({ square: 'd8', type: 'q', color: 'b' });
  });

  it('exposes the legal move list and history on every view', () => {
    const position = played(['e4']);
    const view = position.view();
    expect(view.turn).toBe('b');
    expect(view.legalMoves).toHaveLength(20);
    expect(view.history.map((move) => move.san)).toEqual(['e4']);
    expect(view.fen).toBe(position.fen);
  });
});
