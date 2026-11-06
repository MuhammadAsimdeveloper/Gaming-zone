import { readJson, writeJson } from '../../../lib/storage';
import type { Difficulty } from './simulation';

export const RECORDS_KEY = 'neonrift:game:penalty-protocol:records:v1';
export const SETTINGS_KEY = 'neonrift:game:penalty-protocol:settings:v1';

export interface PenaltyRecords {
  version: 1;
  wins: number;
  losses: number;
  bestScore: number;
  bestSaves: number;
  streak: number;
  bestStreak: number;
  shootouts: number;
}

export interface PenaltySettings {
  version: 1;
  difficulty: Difficulty;
  muted: boolean;
}

export interface ShootoutSummary {
  outcome: 'win' | 'loss';
  score: number;
  saves: number;
}

export const EMPTY_RECORDS: PenaltyRecords = {
  version: 1,
  wins: 0,
  losses: 0,
  bestScore: 0,
  bestSaves: 0,
  streak: 0,
  bestStreak: 0,
  shootouts: 0,
};

export const DEFAULT_SETTINGS: PenaltySettings = {
  version: 1,
  difficulty: 'pro',
  muted: false,
};

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export function parseRecords(value: unknown): PenaltyRecords {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_RECORDS };
  const candidate = value as Partial<PenaltyRecords>;
  if (candidate.version !== 1) return { ...EMPTY_RECORDS };
  const wins = count(candidate.wins);
  const losses = count(candidate.losses);
  const bestScore = count(candidate.bestScore);
  const bestSaves = count(candidate.bestSaves);
  const streak = count(candidate.streak);
  const bestStreak = count(candidate.bestStreak);
  const shootouts = count(candidate.shootouts);
  if (
    wins === null ||
    losses === null ||
    bestScore === null ||
    bestSaves === null ||
    streak === null ||
    bestStreak === null ||
    shootouts === null
  ) {
    return { ...EMPTY_RECORDS };
  }
  return {
    version: 1,
    wins,
    losses,
    bestScore,
    bestSaves,
    streak,
    bestStreak: Math.max(bestStreak, streak),
    shootouts,
  };
}

export function loadRecords(): PenaltyRecords {
  return parseRecords(readJson<unknown>(RECORDS_KEY));
}

export function saveRecords(records: PenaltyRecords): void {
  writeJson(RECORDS_KEY, records);
}

export function recordShootout(
  records: PenaltyRecords,
  summary: ShootoutSummary,
): { records: PenaltyRecords; isBest: boolean } {
  const streak = summary.outcome === 'win' ? records.streak + 1 : 0;
  const next: PenaltyRecords = {
    version: 1,
    wins: records.wins + (summary.outcome === 'win' ? 1 : 0),
    losses: records.losses + (summary.outcome === 'loss' ? 1 : 0),
    bestScore: Math.max(records.bestScore, summary.score),
    bestSaves: Math.max(records.bestSaves, summary.saves),
    streak,
    bestStreak: Math.max(records.bestStreak, streak),
    shootouts: records.shootouts + 1,
  };
  return { records: next, isBest: summary.score > records.bestScore };
}

export function parseSettings(value: unknown): PenaltySettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS };
  const candidate = value as Partial<PenaltySettings>;
  if (candidate.version !== 1) return { ...DEFAULT_SETTINGS };
  if (candidate.difficulty !== 'casual' && candidate.difficulty !== 'pro' && candidate.difficulty !== 'elite') {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof candidate.muted !== 'boolean') return { ...DEFAULT_SETTINGS };
  return { version: 1, difficulty: candidate.difficulty, muted: candidate.muted };
}

export function loadSettings(): PenaltySettings {
  return parseSettings(readJson<unknown>(SETTINGS_KEY));
}

export function saveSettings(settings: PenaltySettings): void {
  writeJson(SETTINGS_KEY, settings);
}
