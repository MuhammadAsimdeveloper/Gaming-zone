import { readJson, writeJson } from '../../lib/storage';

export const RECORDS_KEY = 'neonrift:game:neon-rush:records:v1';
export const SETTINGS_KEY = 'neonrift:game:neon-rush:settings:v1';

export type QualityPreset = 'high' | 'balanced' | 'performance';

export interface NeonRushRecords {
  version: 1;
  bestScore: number;
  bestDistance: number;
  bestShards: number;
  runs: number;
}

export interface NeonRushSettings {
  version: 1;
  quality: QualityPreset;
  muted: boolean;
}

export interface RunSummary {
  score: number;
  distance: number;
  shards: number;
}

export const EMPTY_RECORDS: NeonRushRecords = {
  version: 1,
  bestScore: 0,
  bestDistance: 0,
  bestShards: 0,
  runs: 0,
};

export const DEFAULT_SETTINGS: NeonRushSettings = {
  version: 1,
  quality: 'balanced',
  muted: false,
};

function amount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseRecords(value: unknown): NeonRushRecords {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_RECORDS };
  const candidate = value as Partial<NeonRushRecords>;
  if (candidate.version !== 1) return { ...EMPTY_RECORDS };
  const bestScore = amount(candidate.bestScore);
  const bestDistance = amount(candidate.bestDistance);
  const bestShards = amount(candidate.bestShards);
  const runs = amount(candidate.runs);
  if (bestScore === null || bestDistance === null || bestShards === null || runs === null) {
    return { ...EMPTY_RECORDS };
  }
  return {
    version: 1,
    bestScore,
    bestDistance,
    bestShards,
    runs: Math.floor(runs),
  };
}

export function loadRecords(): NeonRushRecords {
  return parseRecords(readJson<unknown>(RECORDS_KEY));
}

export function saveRecords(records: NeonRushRecords): void {
  writeJson(RECORDS_KEY, records);
}

export function recordRun(
  records: NeonRushRecords,
  summary: RunSummary,
): { records: NeonRushRecords; isBest: boolean } {
  const next: NeonRushRecords = {
    version: 1,
    bestScore: Math.max(records.bestScore, summary.score),
    bestDistance: Math.max(records.bestDistance, summary.distance),
    bestShards: Math.max(records.bestShards, summary.shards),
    runs: records.runs + 1,
  };
  return { records: next, isBest: summary.score > records.bestScore };
}

export function parseSettings(value: unknown): NeonRushSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS };
  const candidate = value as Partial<NeonRushSettings>;
  if (candidate.version !== 1) return { ...DEFAULT_SETTINGS };
  if (candidate.quality !== 'high' && candidate.quality !== 'balanced' && candidate.quality !== 'performance') {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof candidate.muted !== 'boolean') return { ...DEFAULT_SETTINGS };
  return { version: 1, quality: candidate.quality, muted: candidate.muted };
}

export function loadSettings(): NeonRushSettings {
  return parseSettings(readJson<unknown>(SETTINGS_KEY));
}

export function saveSettings(settings: NeonRushSettings): void {
  writeJson(SETTINGS_KEY, settings);
}
