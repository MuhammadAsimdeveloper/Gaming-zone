import { readJson, writeJson } from '../../lib/storage';
import { LEVELS } from './content';

export const PROGRESS_KEY = 'neonrift:game:lawn-protocol:progress:v1';
export const SETTINGS_KEY = 'neonrift:game:lawn-protocol:settings:v1';

export interface LawnProgress {
  version: 1;
  stars: Record<string, number>;
  endlessBestWave: number;
  endlessBestScore: number;
}

export interface LawnSettings {
  version: 1;
  muted: boolean;
}

export const EMPTY_PROGRESS: LawnProgress = {
  version: 1,
  stars: {},
  endlessBestWave: 0,
  endlessBestScore: 0,
};

const LEVEL_IDS = new Set(LEVELS.map((level) => level.id));

function wholeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function starValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const whole = Math.floor(value);
  return whole >= 1 && whole <= 3 ? whole : 0;
}

export function parseProgress(raw: unknown): LawnProgress {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PROGRESS, stars: {} };
  const record = raw as Partial<LawnProgress> & { stars?: unknown };
  if (record.version !== 1) return { ...EMPTY_PROGRESS, stars: {} };

  const stars: Record<string, number> = {};
  if (record.stars && typeof record.stars === 'object' && !Array.isArray(record.stars)) {
    for (const [levelId, value] of Object.entries(record.stars as Record<string, unknown>)) {
      if (!LEVEL_IDS.has(levelId)) continue;
      const starsEarned = starValue(value);
      if (starsEarned > 0) stars[levelId] = starsEarned;
    }
  }

  return {
    version: 1,
    stars,
    endlessBestWave: wholeNumber(record.endlessBestWave),
    endlessBestScore: wholeNumber(record.endlessBestScore),
  };
}

export function parseSettings(raw: unknown): LawnSettings {
  if (!raw || typeof raw !== 'object') return { version: 1, muted: false };
  const record = raw as { version?: unknown; muted?: unknown };
  if (record.version !== 1) return { version: 1, muted: false };
  return { version: 1, muted: record.muted === true };
}

export function loadProgress(): LawnProgress {
  return parseProgress(readJson<unknown>(PROGRESS_KEY));
}

export function saveProgress(progress: LawnProgress): void {
  writeJson(PROGRESS_KEY, progress);
}

export function loadSettings(): LawnSettings {
  return parseSettings(readJson<unknown>(SETTINGS_KEY));
}

export function saveSettings(settings: LawnSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function recordCampaign(
  progress: LawnProgress,
  levelId: string,
  stars: number,
): { progress: LawnProgress; improved: boolean } {
  const earned = starValue(stars);
  const previous = progress.stars[levelId] ?? 0;
  if (earned <= previous) return { progress, improved: false };
  return {
    progress: { ...progress, stars: { ...progress.stars, [levelId]: earned } },
    improved: true,
  };
}

export function recordEndless(
  progress: LawnProgress,
  wave: number,
  score: number,
): { progress: LawnProgress; improvedWave: boolean; improvedScore: boolean } {
  const nextWave = wholeNumber(wave);
  const nextScore = wholeNumber(score);
  const improvedWave = nextWave > progress.endlessBestWave;
  const improvedScore = nextScore > progress.endlessBestScore;
  if (!improvedWave && !improvedScore) {
    return { progress, improvedWave: false, improvedScore: false };
  }
  return {
    progress: {
      ...progress,
      endlessBestWave: Math.max(progress.endlessBestWave, nextWave),
      endlessBestScore: Math.max(progress.endlessBestScore, nextScore),
    },
    improvedWave,
    improvedScore,
  };
}

export function isLevelUnlocked(index: number, progress: LawnProgress): boolean {
  if (index <= 0) return true;
  if (index >= LEVELS.length) return false;
  const previous = LEVELS[index - 1];
  return (progress.stars[previous.id] ?? 0) > 0;
}
