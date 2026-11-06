import { describe, expect, it } from 'vitest';
import {
  createClock,
  elapse,
  flaggedColor,
  formatClock,
  hasMatingMaterial,
  pauseClock,
  resumeClock,
  startTurn,
} from './clock';
import type { PieceView } from './rules';

function piece(square: string, type: PieceView['type'], color: PieceView['color']): PieceView {
  return { square: square as PieceView['square'], type, color };
}

describe('chess clock', () => {
  it('creates equal clocks in milliseconds', () => {
    const clock = createClock(5);
    expect(clock.whiteMs).toBe(300_000);
    expect(clock.blackMs).toBe(300_000);
    expect(clock.active).toBeNull();
  });

  it('deducts elapsed time from the active side only', () => {
    let clock = createClock(5);
    clock = startTurn(clock, 'w', 1_000);
    clock = elapse(clock, 2_500);

    expect(clock.whiteMs).toBe(298_500);
    expect(clock.blackMs).toBe(300_000);
  });

  it('switches the ticking side after a move', () => {
    let clock = createClock(5);
    clock = startTurn(clock, 'w', 1_000);
    clock = elapse(clock, 3_000);
    clock = startTurn(clock, 'b', 3_000);
    clock = elapse(clock, 4_000);

    expect(clock.whiteMs).toBe(298_000);
    expect(clock.blackMs).toBe(299_000);
    expect(clock.active).toBe('b');
  });

  it('does not charge the paused interval on resume', () => {
    let clock = createClock(5);
    clock = startTurn(clock, 'w', 1_000);
    clock = elapse(clock, 3_000);
    clock = pauseClock(clock, 3_000);
    clock = resumeClock(clock, 'w', 33_000);
    clock = elapse(clock, 34_000);

    // The 30s pause is free; the single second of live play after resume is not.
    expect(clock.whiteMs).toBe(297_000);
  });

  it('never drops below zero', () => {
    let clock = createClock(1);
    clock = startTurn(clock, 'w', 0);
    clock = elapse(clock, 120_000);
    expect(clock.whiteMs).toBe(0);
    expect(flaggedColor(clock)).toBe('w');
  });

  it('reports no flag while both sides have time', () => {
    const clock = createClock(10);
    expect(flaggedColor(clock)).toBeNull();
  });

  it('formats minutes and seconds', () => {
    expect(formatClock(300_000)).toBe('5:00');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(999)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
  });
});

describe('mating material', () => {
  it('requires more than a lone king', () => {
    expect(hasMatingMaterial([piece('e1', 'k', 'w')], 'w')).toBe(false);
  });

  it('treats a lone bishop or knight as insufficient', () => {
    expect(hasMatingMaterial([piece('e1', 'k', 'w'), piece('c1', 'b', 'w')], 'w')).toBe(false);
    expect(hasMatingMaterial([piece('e1', 'k', 'w'), piece('b1', 'n', 'w')], 'w')).toBe(false);
  });

  it('counts a pawn, rook or queen as mating material', () => {
    const king = piece('e1', 'k', 'w');
    expect(hasMatingMaterial([king, piece('a2', 'p', 'w')], 'w')).toBe(true);
    expect(hasMatingMaterial([king, piece('a1', 'r', 'w')], 'w')).toBe(true);
    expect(hasMatingMaterial([king, piece('d1', 'q', 'w')], 'w')).toBe(true);
  });

  it('counts two minor pieces as mating material', () => {
    const pieces = [piece('e1', 'k', 'w'), piece('c1', 'b', 'w'), piece('b1', 'n', 'w')];
    expect(hasMatingMaterial(pieces, 'w')).toBe(true);
  });

  it('ignores the opponent colour', () => {
    const pieces = [piece('e1', 'k', 'w'), piece('a8', 'q', 'b')];
    expect(hasMatingMaterial(pieces, 'w')).toBe(false);
  });
});
