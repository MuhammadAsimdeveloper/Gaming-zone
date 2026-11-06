import { readJson, readString, removeKey, writeJson } from '../../lib/storage';
import type { AiLevel } from './ai';
import { RiftChess, START_FEN } from './rules';

export const SAVE_KEY = 'neonrift:game:rift-chess:save:v1';
export const PUZZLE_KEY = 'neonrift:game:rift-chess:puzzles:v1';
export const RECORDS_KEY = 'neonrift:game:rift-chess:records:v1';

export type SavedMode = 'ai' | 'local';
export type SavedOutcome = 'win' | 'loss' | 'draw';

export interface SavedGameV1 {
  version: 1;
  mode: SavedMode;
  fen: string;
  moves: string[];
  playerColor: 'w' | 'b' | null;
  level: AiLevel | null;
  clocks: { whiteMs: number; blackMs: number } | null;
  baseMinutes: number | null;
  savedAt: number;
}

export interface PuzzleProgress {
  version: 1;
  solved: string[];
}

export interface LevelRecord {
  win: number;
  loss: number;
  draw: number;
}

export interface Records {
  version: 1;
  byLevel: Record<AiLevel, LevelRecord>;
}

const LEVELS: AiLevel[] = ['novice', 'casual', 'club', 'expert', 'master'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseMoves(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const moves: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim() === '') return null;
    moves.push(entry);
  }
  return moves;
}

function replay(fen: string, moves: string[]): string | null {
  try {
    const game = new RiftChess(START_FEN);
    for (const san of moves) {
      if (!game.moveSan(san)) return null;
    }
    return game.fen === fen ? game.fen : null;
  } catch {
    return null;
  }
}

function parseSavedGame(raw: unknown): SavedGameV1 | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;

  if (data.version !== 1) return null;
  if (data.mode !== 'ai' && data.mode !== 'local') return null;
  if (typeof data.fen !== 'string' || data.fen.length === 0) return null;

  const moves = parseMoves(data.moves);
  if (!moves) return null;
  if (replay(data.fen, moves) === null) return null;

  const playerColor = data.playerColor === 'w' || data.playerColor === 'b' ? data.playerColor : null;
  const level = LEVELS.includes(data.level as AiLevel) ? (data.level as AiLevel) : null;
  if (data.mode === 'ai' && (playerColor === null || level === null)) return null;

  let clocks: SavedGameV1['clocks'] = null;
  if (typeof data.clocks === 'object' && data.clocks !== null) {
    const source = data.clocks as Record<string, unknown>;
    if (!isFiniteNumber(source.whiteMs) || !isFiniteNumber(source.blackMs)) return null;
    if (source.whiteMs < 0 || source.blackMs < 0) return null;
    clocks = { whiteMs: source.whiteMs, blackMs: source.blackMs };
  }

  const baseMinutes = isFiniteNumber(data.baseMinutes) && data.baseMinutes > 0 ? data.baseMinutes : null;
  if (clocks && baseMinutes === null) return null;

  return {
    version: 1,
    mode: data.mode,
    fen: data.fen,
    moves,
    playerColor,
    level,
    clocks,
    baseMinutes,
    savedAt: isFiniteNumber(data.savedAt) ? data.savedAt : 0,
  };
}

export function saveGame(save: SavedGameV1): boolean {
  if (!parseSavedGame(save)) return false;
  writeJson(SAVE_KEY, save);
  return true;
}

export function loadGame(): SavedGameV1 | null {
  const stored = readString(SAVE_KEY);
  if (stored === null) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    removeKey(SAVE_KEY);
    return null;
  }

  const parsed = parseSavedGame(raw);
  if (!parsed) {
    removeKey(SAVE_KEY);
    return null;
  }
  return parsed;
}

export function clearGame(): void {
  removeKey(SAVE_KEY);
}

export function loadPuzzleProgress(): PuzzleProgress {
  const raw = readJson<unknown>(PUZZLE_KEY);
  if (typeof raw !== 'object' || raw === null) return { version: 1, solved: [] };
  const data = raw as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.solved)) return { version: 1, solved: [] };

  const seen = new Set<string>();
  const solved: string[] = [];
  for (const entry of data.solved) {
    if (typeof entry !== 'string' || seen.has(entry)) continue;
    seen.add(entry);
    solved.push(entry);
  }
  return { version: 1, solved };
}

export function savePuzzleProgress(progress: PuzzleProgress): void {
  writeJson(PUZZLE_KEY, progress);
}

export function emptyRecords(): Records {
  const byLevel = {} as Record<AiLevel, LevelRecord>;
  for (const level of LEVELS) byLevel[level] = { win: 0, loss: 0, draw: 0 };
  return { version: 1, byLevel };
}

export function loadRecords(): Records {
  const raw = readJson<unknown>(RECORDS_KEY);
  if (typeof raw !== 'object' || raw === null) return emptyRecords();
  const data = raw as Record<string, unknown>;
  if (data.version !== 1 || typeof data.byLevel !== 'object' || data.byLevel === null) {
    return emptyRecords();
  }

  const source = data.byLevel as Record<string, unknown>;
  const records = emptyRecords();
  for (const level of LEVELS) {
    const entry = source[level];
    if (typeof entry !== 'object' || entry === null) continue;
    const counts = entry as Record<string, unknown>;
    records.byLevel[level] = {
      win: isFiniteNumber(counts.win) && counts.win >= 0 ? Math.floor(counts.win) : 0,
      loss: isFiniteNumber(counts.loss) && counts.loss >= 0 ? Math.floor(counts.loss) : 0,
      draw: isFiniteNumber(counts.draw) && counts.draw >= 0 ? Math.floor(counts.draw) : 0,
    };
  }
  return records;
}

export function recordResult(level: AiLevel, outcome: SavedOutcome): Records {
  const records = loadRecords();
  records.byLevel[level][outcome] += 1;
  writeJson(RECORDS_KEY, records);
  return records;
}
