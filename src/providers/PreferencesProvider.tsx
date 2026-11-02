import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocalStorageState } from '../lib/useLocalStorageState';

const MAX_RECENT = 24;
const PREFS_KEY = 'neonrift:prefs:v1';

export interface RecentGame {
  gameId: string;
  playedAt: string;
}

interface Preferences {
  favorites: string[];
  recentlyPlayed: RecentGame[];
}

const defaultPreferences: Preferences = {
  favorites: [],
  recentlyPlayed: [],
};

function validatePreferences(value: unknown): Preferences | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  const favorites = Array.isArray(record.favorites)
    ? [...new Set(record.favorites.filter((id): id is string => typeof id === 'string'))]
    : [];

  const recentlyPlayed = Array.isArray(record.recentlyPlayed)
    ? record.recentlyPlayed
        .filter(
          (entry): entry is RecentGame =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as RecentGame).gameId === 'string' &&
            typeof (entry as RecentGame).playedAt === 'string' &&
            !Number.isNaN(new Date((entry as RecentGame).playedAt).getTime()),
        )
        .slice(0, MAX_RECENT)
    : [];

  return { favorites, recentlyPlayed };
}

interface PreferencesContextValue {
  favorites: string[];
  recentlyPlayed: RecentGame[];
  isFavorite: (gameId: string) => boolean;
  toggleFavorite: (gameId: string) => boolean;
  addRecent: (gameId: string) => void;
  clearRecentlyPlayed: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useLocalStorageState<Preferences>(
    PREFS_KEY,
    defaultPreferences,
    validatePreferences,
  );

  const isFavorite = useCallback(
    (gameId: string) => prefs.favorites.includes(gameId),
    [prefs.favorites],
  );

  const toggleFavorite = useCallback(
    (gameId: string) => {
      const nextFavorite = !prefs.favorites.includes(gameId);
      setPrefs((previous) => ({
        ...previous,
        favorites: nextFavorite
          ? [gameId, ...previous.favorites.filter((id) => id !== gameId)]
          : previous.favorites.filter((id) => id !== gameId),
      }));
      return nextFavorite;
    },
    [prefs.favorites, setPrefs],
  );

  const addRecent = useCallback(
    (gameId: string) => {
      const entry: RecentGame = { gameId, playedAt: new Date().toISOString() };
      setPrefs((previous) => ({
        ...previous,
        recentlyPlayed: [
          entry,
          ...previous.recentlyPlayed.filter((recent) => recent.gameId !== gameId),
        ].slice(0, MAX_RECENT),
      }));
    },
    [setPrefs],
  );

  const clearRecentlyPlayed = useCallback(() => {
    setPrefs((previous) => ({ ...previous, recentlyPlayed: [] }));
  }, [setPrefs]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      favorites: prefs.favorites,
      recentlyPlayed: prefs.recentlyPlayed,
      isFavorite,
      toggleFavorite,
      addRecent,
      clearRecentlyPlayed,
    }),
    [prefs, isFavorite, toggleFavorite, addRecent, clearRecentlyPlayed],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
}
