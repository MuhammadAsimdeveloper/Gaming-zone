import { readJson, removeKey, writeJson } from '../../lib/storage';
import { isValidGhost, type GhostRecording } from './ghost';
import type { MedalTier } from './rules';

export const RECORDS_KEY = 'neonrift:game:apex-time-trial:records:v1';
export const GHOST_KEY_PREFIX = 'neonrift:game:apex-time-trial:ghost:v1:';

export interface TrialRecord {
  time: number;
  medal: MedalTier;
  splits: number[];
  setAt: string;
}

export interface TrialRecords {
  version: 1;
  best: Record<string, TrialRecord>;
  runs: number;
}

export interface TrialInput {
  trackId: string;
  carId: string;
  time: number;
  splits: number[];
  medal: MedalTier;
}

export const EMPTY_RECORDS: TrialRecords = { version: 1, best: {}, runs: 0 };

const MEDALS: readonly MedalTier[] = ['author', 'gold', 'silver', 'bronze', 'none'];

export function recordKey(trackId: string, carId: string): string {
  return `${trackId}:${carId}`;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseRecord(value: unknown): TrialRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<TrialRecord>;
  if (!finiteNumber(record.time) || record.time <= 0) return null;
  if (typeof record.medal !== 'string' || !MEDALS.includes(record.medal as MedalTier)) return null;
  if (!Array.isArray(record.splits) || !record.splits.every(finiteNumber)) return null;
  if (typeof record.setAt !== 'string') return null;
  return {
    time: record.time,
    medal: record.medal as MedalTier,
    splits: [...record.splits],
    setAt: record.setAt,
  };
}

export function parseRecords(raw: unknown): TrialRecords {
  if (!raw || typeof raw !== 'object') return { version: 1, best: {}, runs: 0 };
  const parsed = raw as Partial<TrialRecords> & { best?: unknown };
  if (parsed.version !== 1) return { version: 1, best: {}, runs: 0 };

  const best: Record<string, TrialRecord> = {};
  if (parsed.best && typeof parsed.best === 'object' && !Array.isArray(parsed.best)) {
    for (const [key, value] of Object.entries(parsed.best as Record<string, unknown>)) {
      const record = parseRecord(value);
      if (record) best[key] = record;
    }
  }

  return {
    version: 1,
    best,
    runs: finiteNumber(parsed.runs) && parsed.runs > 0 ? Math.floor(parsed.runs) : 0,
  };
}

export function loadRecords(): TrialRecords {
  return parseRecords(readJson<unknown>(RECORDS_KEY));
}

export function saveRecords(records: TrialRecords): void {
  writeJson(RECORDS_KEY, records);
}

export function recordTrial(
  records: TrialRecords,
  input: TrialInput,
  now: Date = new Date(),
): { records: TrialRecords; isBest: boolean } {
  const key = recordKey(input.trackId, input.carId);
  const existing = records.best[key];
  const runs = records.runs + 1;

  if (!Number.isFinite(input.time) || input.time <= 0) {
    return { records: { ...records, runs }, isBest: false };
  }

  if (existing && input.time >= existing.time) {
    return { records: { ...records, runs }, isBest: false };
  }

  return {
    records: {
      version: 1,
      runs,
      best: {
        ...records.best,
        [key]: {
          time: input.time,
          medal: input.medal,
          splits: [...input.splits],
          setAt: now.toISOString(),
        },
      },
    },
    isBest: true,
  };
}

export function loadGhost(trackId: string, carId: string): GhostRecording | null {
  const ghost = readJson<unknown>(GHOST_KEY_PREFIX + recordKey(trackId, carId));
  if (!isValidGhost(ghost)) return null;
  if (ghost.trackId !== trackId || ghost.carId !== carId) return null;
  return ghost;
}

export function saveGhost(recording: GhostRecording): void {
  if (!isValidGhost(recording)) return;
  writeJson(GHOST_KEY_PREFIX + recordKey(recording.trackId, recording.carId), recording);
}

export function clearGhost(trackId: string, carId: string): void {
  removeKey(GHOST_KEY_PREFIX + recordKey(trackId, carId));
}
