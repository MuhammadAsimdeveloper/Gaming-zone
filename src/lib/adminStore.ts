import type { AdPlacement } from '../config/site';
import { AD_PLACEMENTS } from '../config/site';
import { CATEGORY_IDS, INTERNAL_GAME_KEYS } from '../types/game';
import type { CategoryId, Game } from '../types/game';

/*
 * Local-only catalogue overrides. State lives in this browser's localStorage,
 * is never synced, and carries no authority beyond the visitor who wrote it.
 */
export const ADMIN_STATE_KEY = 'neonrift:admin:v1';

export interface AdminState {
  customGames: Game[];
  edits: Record<string, Partial<Game>>;
  deletedIds: string[];
  hiddenCategories: CategoryId[];
  adPlacements: Partial<Record<AdPlacement, boolean>>;
}

export const emptyAdminState: AdminState = {
  customGames: [],
  edits: {},
  deletedIds: [],
  hiddenCategories: [],
  adPlacements: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownCategory(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function isGameLike(value: unknown): value is Game {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.title === 'string' &&
    typeof value.tagline === 'string' &&
    typeof value.description === 'string' &&
    isKnownCategory(value.category) &&
    typeof value.thumbnail === 'string' &&
    typeof value.accent === 'string' &&
    (value.type === 'internal' || value.type === 'external') &&
    (value.internalKey === undefined ||
      (INTERNAL_GAME_KEYS as readonly string[]).includes(String(value.internalKey))) &&
    (value.externalUrl === undefined || typeof value.externalUrl === 'string') &&
    Array.isArray(value.instructions) &&
    value.instructions.every((line) => typeof line === 'string') &&
    Array.isArray(value.controls) &&
    typeof value.published === 'boolean' &&
    typeof value.createdAt === 'string' &&
    typeof value.featured === 'boolean' &&
    typeof value.popularityRank === 'number'
  );
}

export function sanitizeAdminState(value: unknown): AdminState | null {
  if (!isRecord(value)) return null;

  const customGames = Array.isArray(value.customGames)
    ? value.customGames.filter(isGameLike)
    : [];
  const edits = isRecord(value.edits)
    ? (Object.fromEntries(
        Object.entries(value.edits).filter(
          ([id, patch]) => id.length > 0 && isRecord(patch),
        ),
      ) as Record<string, Partial<Game>>)
    : {};
  const deletedIds = Array.isArray(value.deletedIds)
    ? value.deletedIds.filter((id): id is string => typeof id === 'string')
    : [];
  const hiddenCategories = Array.isArray(value.hiddenCategories)
    ? value.hiddenCategories.filter(isKnownCategory)
    : [];
  const adPlacements = isRecord(value.adPlacements)
    ? (Object.fromEntries(
        Object.entries(value.adPlacements).filter(
          ([key, enabled]) =>
            (AD_PLACEMENTS as readonly string[]).includes(key) && typeof enabled === 'boolean',
        ),
      ) as Partial<Record<AdPlacement, boolean>>)
    : {};

  return {
    customGames,
    edits,
    deletedIds: [...new Set(deletedIds)],
    hiddenCategories: [...new Set(hiddenCategories)],
    adPlacements,
  };
}

export function mergeCatalogue(baseGames: Game[], state: AdminState): Game[] {
  const deleted = new Set(state.deletedIds);
  const merged = new Map<string, Game>();

  for (const game of baseGames) {
    const candidate = { ...game, ...(state.edits[game.id] ?? {}) };
    merged.set(game.id, isGameLike(candidate) ? candidate : game);
  }

  for (const game of state.customGames) {
    const existing = merged.get(game.id);
    const candidate = existing ? { ...existing, ...game } : game;
    merged.set(game.id, isGameLike(candidate) ? candidate : game);
  }

  return [...merged.values()].filter((game) => !deleted.has(game.id));
}
