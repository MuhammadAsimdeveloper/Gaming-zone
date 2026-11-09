/**
 * Versioned, browser-local progression for Neon Coast.
 *
 * There is no backend: every field here lives in localStorage. Invalid
 * payloads are rejected by parseSave and replaced with defaults by loadSave.
 */
import { readJson, writeJson } from '../../lib/storage';
import {
  MISSIONS,
  type MissionId,
} from './missions';
import { SOLARA_LANDMARKS } from './world';

export const SAVE_KEY = 'neonrift:game:neon-coast:save';

const MISSION_IDS = MISSIONS.map((mission) => mission.id);
const LANDMARK_IDS = new Set(SOLARA_LANDMARKS.map((landmark) => landmark.id));
const GLOW_SHARD_COUNT = 8;

export interface NeonCoastSave {
  version: 1;
  cash: number;
  completed: MissionId[];
  bestTimes: Partial<Record<MissionId, number>>;
  bestGlowScore: number;
  discovered: string[];
  tutorialSeen: boolean;
  soundOn: boolean;
}

export type ProgressEvent =
  | { type: 'mission-complete'; id: MissionId; reward: number; elapsed: number; shards: number }
  | { type: 'mission-failed'; id: MissionId; reward: number; elapsed: number; shards: number }
  | { type: 'discover'; id: string }
  | { type: 'sound'; on: boolean }
  | { type: 'tutorial-seen' };

export function defaultSave(): NeonCoastSave {
  return {
    version: 1,
    cash: 0,
    completed: [],
    bestTimes: {},
    bestGlowScore: 0,
    discovered: [],
    tutorialSeen: false,
    soundOn: true,
  };
}

function isMissionId(value: unknown): value is MissionId {
  return typeof value === 'string' && MISSION_IDS.includes(value as MissionId);
}

function readCash(value: unknown): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Save cash must be a finite number');
  }
  if (value < 0) throw new Error('Save cash cannot be negative');
  return Math.floor(value);
}

function readCompleted(value: unknown): MissionId[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Save missions must be an array');
  const completed: MissionId[] = [];
  for (const id of value) {
    if (!isMissionId(id)) throw new Error(`Unknown mission id ${String(id)}`);
    if (!completed.includes(id)) completed.push(id);
  }
  return completed;
}

function readBestTimes(value: unknown): Partial<Record<MissionId, number>> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Save best times must be an object');
  }
  const bestTimes: Partial<Record<MissionId, number>> = {};
  for (const [id, time] of Object.entries(value as Record<string, unknown>)) {
    if (!isMissionId(id)) throw new Error(`Unknown mission id ${id}`);
    if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0) {
      throw new Error(`Best time for ${id} must be a positive number`);
    }
    bestTimes[id] = time;
  }
  return bestTimes;
}

function readGlowScore(value: unknown): number {
  if (value === undefined) return 0;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > GLOW_SHARD_COUNT
  ) {
    throw new Error('Save glow score must be between zero and eight');
  }
  return Math.floor(value);
}

function readDiscovered(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Save landmarks must be an array');
  const discovered: string[] = [];
  for (const id of value) {
    if (typeof id !== 'string' || !LANDMARK_IDS.has(id)) {
      throw new Error(`Unknown landmark id ${String(id)}`);
    }
    if (!discovered.includes(id)) discovered.push(id);
  }
  return discovered;
}

export function parseSave(raw: unknown): NeonCoastSave {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Neon Coast save must be an object');
  }
  const record = data as Record<string, unknown>;
  if (record.version !== 1) throw new Error('Unsupported save version');

  return {
    version: 1,
    cash: readCash(record.cash),
    completed: readCompleted(record.completed),
    bestTimes: readBestTimes(record.bestTimes),
    bestGlowScore: readGlowScore(record.bestGlowScore),
    discovered: readDiscovered(record.discovered),
    tutorialSeen: record.tutorialSeen === true,
    soundOn: record.soundOn !== false,
  };
}

export function loadSave(): NeonCoastSave {
  try {
    return parseSave(readJson<unknown>(SAVE_KEY));
  } catch {
    return defaultSave();
  }
}

export function saveProgress(save: NeonCoastSave): void {
  writeJson(SAVE_KEY, save);
}

export function applyEvent(save: NeonCoastSave, event: ProgressEvent): NeonCoastSave {
  switch (event.type) {
    case 'mission-complete': {
      const completed = save.completed.includes(event.id)
        ? save.completed
        : [...save.completed, event.id];
      const previous = save.bestTimes[event.id];
      const best =
        event.elapsed > 0 && (previous === undefined || event.elapsed < previous)
          ? event.elapsed
          : previous;
      const bestTimes = { ...save.bestTimes };
      if (best !== undefined) bestTimes[event.id] = best;
      return {
        ...save,
        cash: save.cash + Math.max(0, Math.floor(event.reward)),
        completed,
        bestTimes,
        bestGlowScore:
          event.id === 'glow-run'
            ? Math.max(save.bestGlowScore, Math.min(GLOW_SHARD_COUNT, Math.floor(event.shards)))
            : save.bestGlowScore,
      };
    }
    case 'mission-failed':
      return {
        ...save,
        cash: save.cash + Math.max(0, Math.floor(event.reward)),
        bestGlowScore:
          event.id === 'glow-run'
            ? Math.max(save.bestGlowScore, Math.min(GLOW_SHARD_COUNT, Math.floor(event.shards)))
            : save.bestGlowScore,
      };
    case 'discover':
      if (!LANDMARK_IDS.has(event.id) || save.discovered.includes(event.id)) return save;
      return { ...save, discovered: [...save.discovered, event.id] };
    case 'sound':
      return { ...save, soundOn: event.on };
    case 'tutorial-seen':
      return save.tutorialSeen ? save : { ...save, tutorialSeen: true };
    default:
      return save;
  }
}
