import type { Color } from 'chess.js';
import type { PieceView } from './rules';

export interface ChessClock {
  whiteMs: number;
  blackMs: number;
  active: Color | null;
  lastTick: number | null;
}

export function createClock(minutes: number): ChessClock {
  const ms = Math.round(minutes * 60_000);
  return { whiteMs: ms, blackMs: ms, active: null, lastTick: null };
}

export function elapse(clock: ChessClock, now: number): ChessClock {
  if (clock.active === null || clock.lastTick === null) return clock;
  const delta = Math.max(0, now - clock.lastTick);
  if (clock.active === 'w') {
    return { ...clock, whiteMs: Math.max(0, clock.whiteMs - delta), lastTick: now };
  }
  return { ...clock, blackMs: Math.max(0, clock.blackMs - delta), lastTick: now };
}

export function startTurn(clock: ChessClock, turn: Color, now: number): ChessClock {
  return { ...clock, active: turn, lastTick: now };
}

export function pauseClock(clock: ChessClock, now: number): ChessClock {
  const settled = elapse(clock, now);
  return { ...settled, active: null, lastTick: null };
}

export function resumeClock(clock: ChessClock, turn: Color, now: number): ChessClock {
  return { ...clock, active: turn, lastTick: now };
}

export function flaggedColor(clock: ChessClock): Color | null {
  if (clock.whiteMs <= 0) return 'w';
  if (clock.blackMs <= 0) return 'b';
  return null;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function hasMatingMaterial(pieces: PieceView[], color: Color): boolean {
  const own = pieces.filter((piece) => piece.color === color);
  let minors = 0;
  for (const piece of own) {
    if (piece.type === 'p' || piece.type === 'r' || piece.type === 'q') return true;
    if (piece.type === 'b' || piece.type === 'n') minors += 1;
  }
  return minors >= 2;
}
