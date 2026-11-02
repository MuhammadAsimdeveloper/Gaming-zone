import { createContext, useCallback, useContext, useMemo } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { AdPlacement } from '../config/site';
import { categories, type Category } from '../data/categories';
import { baseGames, countByCategory } from '../data/games';
import {
  ADMIN_STATE_KEY,
  emptyAdminState,
  mergeCatalogue,
  sanitizeAdminState,
  type AdminState,
} from '../lib/adminStore';
import { useLocalStorageState } from '../lib/useLocalStorageState';
import type { CategoryId, Game } from '../types/game';

interface CatalogueContextValue {
  games: Game[];
  publishedGames: Game[];
  categoryCounts: Record<CategoryId, number>;
  visibleCategories: Category[];
  adminState: AdminState;
  setAdminState: Dispatch<SetStateAction<AdminState>>;
  getGameBySlug: (slug: string) => Game | undefined;
  getGameById: (id: string) => Game | undefined;
  saveGame: (game: Game) => void;
  updateGame: (id: string, patch: Partial<Game>) => void;
  deleteGame: (id: string) => void;
  setCategoryHidden: (id: CategoryId, hidden: boolean) => void;
  isAdPlacementEnabled: (placement: AdPlacement) => boolean;
  setAdPlacementEnabled: (placement: AdPlacement, enabled: boolean) => void;
  resetAdminState: () => void;
}

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const [adminState, setAdminState] = useLocalStorageState<AdminState>(
    ADMIN_STATE_KEY,
    emptyAdminState,
    sanitizeAdminState,
  );

  const games = useMemo(() => mergeCatalogue(baseGames, adminState), [adminState]);
  const publishedGames = useMemo(() => games.filter((game) => game.published), [games]);
  const categoryCounts = useMemo(() => countByCategory(publishedGames), [publishedGames]);

  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          !adminState.hiddenCategories.includes(category.id) &&
          (category.id !== 'multiplayer' || (categoryCounts.multiplayer ?? 0) > 0),
      ),
    [adminState.hiddenCategories, categoryCounts],
  );

  const getGameBySlug = useCallback(
    (slug: string) => publishedGames.find((game) => game.slug === slug),
    [publishedGames],
  );

  const getGameById = useCallback(
    (id: string) => games.find((game) => game.id === id),
    [games],
  );

  const saveGame = useCallback(
    (game: Game) => {
      setAdminState((previous) => {
        const isBaseGame = baseGames.some((base) => base.id === game.id);
        if (isBaseGame) {
          return {
            ...previous,
            edits: {
              ...previous.edits,
              [game.id]: { ...(previous.edits[game.id] ?? {}), ...game },
            },
            deletedIds: previous.deletedIds.filter((id) => id !== game.id),
          };
        }

        const exists = previous.customGames.some((custom) => custom.id === game.id);
        return {
          ...previous,
          customGames: exists
            ? previous.customGames.map((custom) => (custom.id === game.id ? game : custom))
            : [...previous.customGames, game],
          deletedIds: previous.deletedIds.filter((id) => id !== game.id),
        };
      });
    },
    [setAdminState],
  );

  const updateGame = useCallback(
    (id: string, patch: Partial<Game>) => {
      setAdminState((previous) => {
        const isBaseGame = baseGames.some((base) => base.id === id);
        if (isBaseGame) {
          return {
            ...previous,
            edits: {
              ...previous.edits,
              [id]: { ...(previous.edits[id] ?? {}), ...patch },
            },
            deletedIds: previous.deletedIds.filter((deletedId) => deletedId !== id),
          };
        }

        return {
          ...previous,
          customGames: previous.customGames.map((custom) =>
            custom.id === id ? { ...custom, ...patch } : custom,
          ),
        };
      });
    },
    [setAdminState],
  );

  const deleteGame = useCallback(
    (id: string) => {
      setAdminState((previous) => {
        const isBaseGame = baseGames.some((base) => base.id === id);
        return {
          ...previous,
          customGames: previous.customGames.filter((custom) => custom.id !== id),
          edits: Object.fromEntries(
            Object.entries(previous.edits).filter(([gameId]) => gameId !== id),
          ),
          deletedIds: isBaseGame
            ? [...new Set([...previous.deletedIds, id])]
            : previous.deletedIds,
        };
      });
    },
    [setAdminState],
  );

  const setCategoryHidden = useCallback(
    (id: CategoryId, hidden: boolean) => {
      setAdminState((previous) => ({
        ...previous,
        hiddenCategories: hidden
          ? [...new Set([...previous.hiddenCategories, id])]
          : previous.hiddenCategories.filter((categoryId) => categoryId !== id),
      }));
    },
    [setAdminState],
  );

  const isAdPlacementEnabled = useCallback(
    (placement: AdPlacement) => adminState.adPlacements[placement] !== false,
    [adminState.adPlacements],
  );

  const setAdPlacementEnabled = useCallback(
    (placement: AdPlacement, enabled: boolean) => {
      setAdminState((previous) => ({
        ...previous,
        adPlacements: { ...previous.adPlacements, [placement]: enabled },
      }));
    },
    [setAdminState],
  );

  const resetAdminState = useCallback(() => {
    setAdminState(emptyAdminState);
  }, [setAdminState]);

  const value = useMemo<CatalogueContextValue>(
    () => ({
      games,
      publishedGames,
      categoryCounts,
      visibleCategories,
      adminState,
      setAdminState,
      getGameBySlug,
      getGameById,
      saveGame,
      updateGame,
      deleteGame,
      setCategoryHidden,
      isAdPlacementEnabled,
      setAdPlacementEnabled,
      resetAdminState,
    }),
    [
      games,
      publishedGames,
      categoryCounts,
      visibleCategories,
      adminState,
      setAdminState,
      getGameBySlug,
      getGameById,
      saveGame,
      updateGame,
      deleteGame,
      setCategoryHidden,
      isAdPlacementEnabled,
      setAdPlacementEnabled,
      resetAdminState,
    ],
  );

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogue(): CatalogueContextValue {
  const context = useContext(CatalogueContext);
  if (!context) throw new Error('useCatalogue must be used inside CatalogueProvider');
  return context;
}
