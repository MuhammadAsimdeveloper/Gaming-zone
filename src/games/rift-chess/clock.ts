export type ClockSide = 'w' | 'b';

export interface ChessClockState {
  remainingMs: Record<ClockSide, number>;
  active: ClockSide | null;
  incrementMs: number;
  running: boolean;
  lastUpdatedAt: number | null;
  flagged: ClockSide | null;
}

export function createClock(
  initialMs = 5 * 60_000,
  incrementMs = 0,
  firstSide: ClockSide = 'w',
): ChessClockState {
  if (!Number.isFinite(initialMs) || initialMs < 0) throw new RangeError('Clock time must be a finite non-negative number.');
  if (!Number.isFinite(incrementMs) || incrementMs < 0) throw new RangeError('Clock increment must be a finite non-negative number.');
  return {
    remainingMs: { w: initialMs, b: initialMs },
    active: firstSide,
    incrementMs,
    running: false,
    lastUpdatedAt: null,
    flagged: null,
  };
}

/** Start a stopped clock using a monotonic timestamp such as performance.now(). */
export function startClock(clock: ChessClockState, now: number): ChessClockState {
  if (!Number.isFinite(now)) throw new RangeError('Clock timestamp must be finite.');
  if (clock.running || clock.active === null || clock.flagged !== null) return clock;
  return { ...clock, running: true, lastUpdatedAt: now };
}

/** Advance elapsed time without timer drift; callers may invoke this per animation frame. */
export function advanceClock(clock: ChessClockState, now: number): ChessClockState {
  if (!Number.isFinite(now)) throw new RangeError('Clock timestamp must be finite.');
  if (!clock.running || clock.active === null || clock.lastUpdatedAt === null || clock.flagged !== null) return clock;

  const timestamp = Math.max(now, clock.lastUpdatedAt);
  const elapsed = timestamp - clock.lastUpdatedAt;
  const remaining = Math.max(0, clock.remainingMs[clock.active] - elapsed);
  if (remaining === 0) {
    return {
      ...clock,
      remainingMs: { ...clock.remainingMs, [clock.active]: 0 },
      active: null,
      running: false,
      lastUpdatedAt: timestamp,
      flagged: clock.active,
    };
  }
  return {
    ...clock,
    remainingMs: { ...clock.remainingMs, [clock.active]: remaining },
    lastUpdatedAt: timestamp,
  };
}

/** Complete the active player's move, award increment, and start the opponent's clock. */
export function completeClockMove(
  clock: ChessClockState,
  nextSide: ClockSide,
  now: number,
): ChessClockState {
  const advanced = advanceClock(clock, now);
  if (advanced.flagged !== null || advanced.active === null) return advanced;
  const mover = advanced.active;
  const bonus = advanced.running ? advanced.incrementMs : 0;
  return {
    ...advanced,
    remainingMs: { ...advanced.remainingMs, [mover]: advanced.remainingMs[mover] + bonus },
    active: nextSide,
    running: true,
    lastUpdatedAt: now,
  };
}

export function pauseClock(clock: ChessClockState, now: number): ChessClockState {
  const advanced = advanceClock(clock, now);
  if (advanced.flagged !== null) return advanced;
  return { ...advanced, running: false, lastUpdatedAt: null };
}

export function resumeClock(clock: ChessClockState, now: number): ChessClockState {
  return startClock(clock, now);
}
