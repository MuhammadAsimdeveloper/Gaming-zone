import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readJson, writeJson } from './storage';

export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => T | null,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const stored = readJson<unknown>(key);
    if (stored !== null) {
      const validated = validate ? validate(stored) : (stored as T);
      if (validated !== null) return validated;
    }
    return fallback;
  });

  useEffect(() => {
    writeJson(key, state);
  }, [key, state]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== key) return;
      if (event.newValue === null) {
        setState(fallback);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(event.newValue);
        const validated = validate ? validate(parsed) : (parsed as T);
        if (validated !== null) setState(validated);
      } catch {
        // Ignore malformed values written by another tab.
      }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, fallback, validate]);

  return [state, setState];
}
