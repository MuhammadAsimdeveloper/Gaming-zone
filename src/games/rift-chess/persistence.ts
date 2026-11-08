import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { AiLevel } from './ai';
import type { ChessClockState } from './clock';

export const RIFT_CHESS_SAVE_KEY = 'neonrift:rift-chess:save:v1';
export const RIFT_CHESS_SAVE_VERSION = 1 as const;
export type SavedMode = 'local' | 'computer' | 'free';

export interface SavedGameOptions {
  mode: SavedMode;
  playerColor: 'w' | 'b';
  aiLevel: AiLevel;
  orientation: 'w' | 'b';
  clockPreset?: 'off' | '5+0' | '10+0' | '10+5';
  startFen: string;
  clock?: ChessClockState | null;
  clockHistory?: ChessClockState[];
}

export interface SavedMove {
  from: Square;
  to: Square;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface RiftChessSave {
  version: typeof RIFT_CHESS_SAVE_VERSION;
  savedAt: string;
  fen: string;
  pgn: string;
  moves: SavedMove[];
  options: SavedGameOptions;
}

export interface RestoredGame {
  game: Chess;
  options: SavedGameOptions;
  savedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function isValidClockState(value: unknown): value is ChessClockState {
  if (!value || typeof value !== 'object') return false;
  const clock = value as Record<string, unknown>;
  const remaining = clock.remainingMs as Record<string, unknown> | undefined;
  const validTime = (time: unknown) => typeof time === 'number' && Number.isFinite(time) && time >= 0;
  return !!remaining
    && validTime(remaining.w)
    && validTime(remaining.b)
    && (clock.active === null || clock.active === 'w' || clock.active === 'b')
    && validTime(clock.incrementMs)
    && typeof clock.running === 'boolean'
    && (clock.lastUpdatedAt === null || (typeof clock.lastUpdatedAt === 'number' && Number.isFinite(clock.lastUpdatedAt)))
    && (clock.flagged === null || clock.flagged === 'w' || clock.flagged === 'b');
}

function isValidOptions(value: unknown): value is SavedGameOptions {
  if (!value || typeof value !== 'object') return false;
  const options = value as Record<string, unknown>;
  return (options.mode === 'local' || options.mode === 'computer' || options.mode === 'free')
    && (options.playerColor === 'w' || options.playerColor === 'b')
    && [1, 2, 3, 4, 5].includes(options.aiLevel as number)
    && (options.orientation === 'w' || options.orientation === 'b')
    && (options.clockPreset === undefined || ['off', '5+0', '10+0', '10+5'].includes(String(options.clockPreset)))
    && typeof options.startFen === 'string'
    && (options.clock === undefined || options.clock === null || isValidClockState(options.clock))
    && (options.clockHistory === undefined
      || (Array.isArray(options.clockHistory) && options.clockHistory.length <= 600 && options.clockHistory.every(isValidClockState)));
}

function isValidMove(value: unknown): value is SavedMove {
  if (!value || typeof value !== 'object') return false;
  const move = value as Record<string, unknown>;
  const square = (input: unknown) => typeof input === 'string' && /^[a-h][1-8]$/.test(input);
  return square(move.from) && square(move.to)
    && (move.promotion === undefined || ['q', 'r', 'b', 'n'].includes(String(move.promotion)));
}

export function createSaveSnapshot(
  game: Chess,
  options: SavedGameOptions,
  now = new Date(),
): RiftChessSave {
  if (!isValidOptions(options)) throw new TypeError('Invalid Rift Chess save options.');
  const moves = game.history({ verbose: true }).map((move) => ({
    from: move.from,
    to: move.to,
    ...(move.promotion ? { promotion: move.promotion as SavedMove['promotion'] } : {}),
  }));
  return {
    version: RIFT_CHESS_SAVE_VERSION,
    savedAt: now.toISOString(),
    fen: game.fen(),
    pgn: game.pgn(),
    moves,
    options,
  };
}

/** Replays moves from the recorded start position and verifies the saved FEN. */
export function restoreSaveSnapshot(value: unknown): RestoredGame | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Partial<RiftChessSave>;
  if (snapshot.version !== RIFT_CHESS_SAVE_VERSION
    || typeof snapshot.savedAt !== 'string'
    || !Number.isFinite(Date.parse(snapshot.savedAt))
    || typeof snapshot.fen !== 'string'
    || typeof snapshot.pgn !== 'string'
    || !Array.isArray(snapshot.moves)
    || !snapshot.moves.every(isValidMove)
    || !isValidOptions(snapshot.options)) return null;

  try {
    const game = new Chess(snapshot.options.startFen);
    for (const move of snapshot.moves) {
      const applied = game.move({
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion } : {}),
      });
      if (!applied) return null;
    }
    if (game.fen() !== snapshot.fen) return null;
    return { game, options: snapshot.options, savedAt: snapshot.savedAt };
  } catch {
    return null;
  }
}

export function saveGame(
  storage: StorageLike,
  game: Chess,
  options: SavedGameOptions,
  now = new Date(),
): boolean {
  try {
    storage.setItem(RIFT_CHESS_SAVE_KEY, JSON.stringify(createSaveSnapshot(game, options, now)));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: StorageLike): RestoredGame | null {
  try {
    const raw = storage.getItem(RIFT_CHESS_SAVE_KEY);
    if (!raw) return null;
    return restoreSaveSnapshot(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function clearSavedGame(storage: StorageLike): void {
  try {
    storage.removeItem?.(RIFT_CHESS_SAVE_KEY);
  } catch {
    // Storage may be unavailable or blocked; callers can safely ignore cleanup failures.
  }
}
