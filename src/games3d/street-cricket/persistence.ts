import { readJson, writeJson } from '../../lib/storage';
import type { MatchFormat, MatchOutcome } from './rules';
import { DISTRICTS, districtById } from './teams';

export const RECORDS_KEY = 'neonrift:game:street-cricket:records:v1';
export const SETTINGS_KEY = 'neonrift:game:street-cricket:settings:v1';

export interface CricketRecords {
  version: 1;
  games: number;
  wins: number;
  bestSuperOver: number;
  bestChase: number;
  bestNets: number;
  sixes: number;
  fours: number;
}

export interface CricketSettings {
  version: 1;
  format: MatchFormat;
  districtId: string;
  muted: boolean;
}

export interface MatchSummary {
  format: MatchFormat;
  runs: number;
  outcome: MatchOutcome;
  sixes: number;
  fours: number;
}

export const EMPTY_RECORDS: CricketRecords = {
  version: 1,
  games: 0,
  wins: 0,
  bestSuperOver: 0,
  bestChase: 0,
  bestNets: 0,
  sixes: 0,
  fours: 0,
};

export const DEFAULT_SETTINGS: CricketSettings = {
  version: 1,
  format: 'super-over',
  districtId: DISTRICTS[0]!.id,
  muted: false,
};

const FORMATS: ReadonlyArray<MatchFormat> = ['super-over', 'rooftop-chase', 'nets'];

const BEST_KEY: Record<MatchFormat, 'bestSuperOver' | 'bestChase' | 'bestNets'> = {
  'super-over': 'bestSuperOver',
  'rooftop-chase': 'bestChase',
  nets: 'bestNets',
};

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export function parseRecords(value: unknown): CricketRecords {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_RECORDS };
  const candidate = value as Partial<CricketRecords>;
  if (candidate.version !== 1) return { ...EMPTY_RECORDS };
  const counters = {
    games: count(candidate.games),
    wins: count(candidate.wins),
    bestSuperOver: count(candidate.bestSuperOver),
    bestChase: count(candidate.bestChase),
    bestNets: count(candidate.bestNets),
    sixes: count(candidate.sixes),
    fours: count(candidate.fours),
  };
  if (Object.values(counters).some((entry) => entry === null)) return { ...EMPTY_RECORDS };
  return { version: 1, ...(counters as Omit<CricketRecords, 'version'>) };
}

export function loadRecords(): CricketRecords {
  return parseRecords(readJson<unknown>(RECORDS_KEY));
}

export function saveRecords(records: CricketRecords): void {
  writeJson(RECORDS_KEY, records);
}

export function recordMatch(
  records: CricketRecords,
  summary: MatchSummary,
): { records: CricketRecords; isBest: boolean } {
  const key = BEST_KEY[summary.format];
  const previousBest = records[key];
  const next: CricketRecords = {
    version: 1,
    games: records.games + 1,
    wins: records.wins + (summary.outcome === 'win' ? 1 : 0),
    bestSuperOver: records.bestSuperOver,
    bestChase: records.bestChase,
    bestNets: records.bestNets,
    sixes: records.sixes + summary.sixes,
    fours: records.fours + summary.fours,
    [key]: Math.max(previousBest, summary.runs),
  };
  return { records: next, isBest: summary.runs > previousBest };
}

export function parseSettings(value: unknown): CricketSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS };
  const candidate = value as Partial<CricketSettings>;
  if (candidate.version !== 1) return { ...DEFAULT_SETTINGS };
  if (!FORMATS.includes(candidate.format as MatchFormat)) return { ...DEFAULT_SETTINGS };
  if (typeof candidate.muted !== 'boolean') return { ...DEFAULT_SETTINGS };
  if (typeof candidate.districtId !== 'string' || !DISTRICTS.some((district) => district.id === candidate.districtId)) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    version: 1,
    format: candidate.format as MatchFormat,
    districtId: districtById(candidate.districtId).id,
    muted: candidate.muted,
  };
}

export function loadSettings(): CricketSettings {
  return parseSettings(readJson<unknown>(SETTINGS_KEY));
}

export function saveSettings(settings: CricketSettings): void {
  writeJson(SETTINGS_KEY, settings);
}
