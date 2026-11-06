import { readJson, writeJson } from '../../../lib/storage';
import type { HoopDifficulty } from './simulation';

export const RECORDS_KEY = 'neonrift:game:hoop-circuit:records:v1';
export const SETTINGS_KEY = 'neonrift:game:hoop-circuit:settings:v1';

export interface HoopRecords {
  version: 1;
  bestScore: number;
  bestStreak: number;
  games: number;
  makes: number;
  shots: number;
  streak: number;
}

export interface HoopSettings {
  version: 1;
  difficulty: HoopDifficulty;
  muted: boolean;
}

export interface GameSummary {
  score: number;
  streak: number;
  makes: number;
  shots: number;
}

export const EMPTY_RECORDS: HoopRecords = {
  version: 1,
  bestScore: 0,
  bestStreak: 0,
  games: 0,
  makes: 0,
  shots: 0,
  streak: 0,
};

export const DEFAULT_SETTINGS: HoopSettings = {
  version: 1,
  difficulty: 'pro',
  muted: false,
};

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export function parseRecords(value: unknown): HoopRecords {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_RECORDS };
  const candidate = value as Partial<HoopRecords>;
  if (candidate.version !== 1) return { ...EMPTY_RECORDS };
  const bestScore = count(candidate.bestScore);
  const bestStreak = count(candidate.bestStreak);
  const games = count(candidate.games);
  const makes = count(candidate.makes);
  const shots = count(candidate.shots);
  const streak = count(candidate.streak);
  if (
    bestScore === null ||
    bestStreak === null ||
    games === null ||
    makes === null ||
    shots === null ||
    streak === null
  ) {
    return { ...EMPTY_RECORDS };
  }
  return {
    version: 1,
    bestScore,
    bestStreak: Math.max(bestStreak, streak),
    games,
    makes,
    shots,
    streak,
  };
}

export function loadRecords(): HoopRecords {
  return parseRecords(readJson<unknown>(RECORDS_KEY));
}

export function saveRecords(records: HoopRecords): void {
  writeJson(RECORDS_KEY, records);
}

export function recordGame(records: HoopRecords, summary: GameSummary): { records: HoopRecords; isBest: boolean } {
  const next: HoopRecords = {
    version: 1,
    bestScore: Math.max(records.bestScore, summary.score),
    bestStreak: Math.max(records.bestStreak, summary.streak),
    games: records.games + 1,
    makes: records.makes + summary.makes,
    shots: records.shots + summary.shots,
    streak: summary.streak,
  };
  return { records: next, isBest: summary.score > records.bestScore };
}

export function parseSettings(value: unknown): HoopSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS };
  const candidate = value as Partial<HoopSettings>;
  if (candidate.version !== 1) return { ...DEFAULT_SETTINGS };
  if (candidate.difficulty !== 'rookie' && candidate.difficulty !== 'pro' && candidate.difficulty !== 'allstar') {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof candidate.muted !== 'boolean') return { ...DEFAULT_SETTINGS };
  return { version: 1, difficulty: candidate.difficulty, muted: candidate.muted };
}

export function loadSettings(): HoopSettings {
  return parseSettings(readJson<unknown>(SETTINGS_KEY));
}

export function saveSettings(settings: HoopSettings): void {
  writeJson(SETTINGS_KEY, settings);
}
