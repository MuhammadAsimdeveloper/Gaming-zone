import { useCallback, useEffect, useRef, useState } from 'react';

function readScore(storageKey: string): number | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeScore(storageKey: string, value: number): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey, String(value));
  } catch {
    // Storage can be unavailable (private mode / blocked cookies). Scores stay in memory.
  }
}

export interface BestScoreState {
  best: number | null;
  submit: (score: number) => void;
}

/**
 * Persists a single best score for a game. Higher is better by default; pass
 * `lowerIsBetter` for timing / move-count records.
 */
export function useBestScore(storageKey: string, lowerIsBetter = false): BestScoreState {
  const [best, setBest] = useState<number | null>(() => readScore(storageKey));
  const bestRef = useRef<number | null>(best);

  useEffect(() => {
    const stored = readScore(storageKey);
    bestRef.current = stored;
    setBest(stored);
  }, [storageKey]);

  const submit = useCallback(
    (score: number) => {
      if (!Number.isFinite(score)) return;

      const normalized = Math.round(score);
      const stored = readScore(storageKey);
      const current =
        stored === null
          ? bestRef.current
          : bestRef.current === null
            ? stored
            : lowerIsBetter
              ? Math.min(stored, bestRef.current)
              : Math.max(stored, bestRef.current);

      if (current === null) {
        bestRef.current = normalized;
        setBest(normalized);
        writeScore(storageKey, normalized);
        return;
      }

      const improves = lowerIsBetter ? normalized < current : normalized > current;
      if (improves) {
        bestRef.current = normalized;
        setBest(normalized);
        writeScore(storageKey, normalized);
        return;
      }

      if (current !== bestRef.current || current !== stored) {
        bestRef.current = current;
        setBest(current);
        writeScore(storageKey, current);
      }
    },
    [lowerIsBetter, storageKey],
  );

  return { best, submit };
}
