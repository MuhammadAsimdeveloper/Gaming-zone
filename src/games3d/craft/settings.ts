import { readJson, writeJson } from '../../lib/storage';
import {
  DESKTOP_RENDER_DISTANCE,
  MOBILE_RENDER_DISTANCE,
  clampRenderDistance,
  type QualityTier,
} from './streaming';

export const CRAFT_SETTINGS_KEY = 'neonrift:craft:settings';

export interface CraftPreferences {
  renderDistance: number;
  fov: number;
  sensitivity: number;
  shadows: boolean;
  reducedEffects: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function defaultPreferences(tier: QualityTier): CraftPreferences {
  return {
    renderDistance: tier === 'mobile' ? MOBILE_RENDER_DISTANCE : DESKTOP_RENDER_DISTANCE,
    fov: 75,
    sensitivity: 1,
    shadows: tier !== 'mobile',
    reducedEffects: false,
  };
}

export function sanitizePreferences(raw: unknown, tier: QualityTier): CraftPreferences {
  const fallback = defaultPreferences(tier);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fallback;
  const field = raw as Record<string, unknown>;

  return {
    renderDistance:
      typeof field.renderDistance === 'number' && Number.isFinite(field.renderDistance)
        ? clampRenderDistance(tier, field.renderDistance)
        : fallback.renderDistance,
    fov:
      typeof field.fov === 'number' && Number.isFinite(field.fov)
        ? Math.round(clamp(field.fov, 60, 90))
        : fallback.fov,
    sensitivity:
      typeof field.sensitivity === 'number' && Number.isFinite(field.sensitivity)
        ? Math.round(clamp(field.sensitivity, 0.2, 3) * 100) / 100
        : fallback.sensitivity,
    shadows: typeof field.shadows === 'boolean' ? field.shadows : fallback.shadows,
    reducedEffects:
      typeof field.reducedEffects === 'boolean'
        ? field.reducedEffects
        : fallback.reducedEffects,
  };
}

export function loadPreferences(tier: QualityTier): CraftPreferences {
  return sanitizePreferences(readJson<unknown>(CRAFT_SETTINGS_KEY), tier);
}

export function savePreferences(preferences: CraftPreferences): void {
  writeJson(CRAFT_SETTINGS_KEY, preferences);
}

export function clampSensitivity(value: number): number {
  return Math.round(clamp(value, 0.2, 3) * 100) / 100;
}

export function clampFov(value: number): number {
  return Math.round(clamp(value, 60, 90));
}