import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVERTISING_CONSENT_KEY,
  ANALYTICS_CONSENT_KEY,
  clearConsent,
  getConsentSnapshot,
  needsConsentDecision,
  parseConsent,
  readConsent,
  refreshConsent,
  regionGroupFromTimeZone,
  setConsent,
  subscribeConsent,
  type ConsentSnapshot,
  type ConsentState,
} from './consent';

function installStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };

  vi.stubGlobal('window', { localStorage });
  refreshConsent();
  return values;
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseConsent', () => {
  it('accepts only the two explicit decisions', () => {
    expect(parseConsent('granted')).toBe('granted');
    expect(parseConsent('denied')).toBe('denied');
  });

  it('treats missing or unknown values as undecided', () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent('')).toBeNull();
    expect(parseConsent('yes')).toBeNull();
    expect(parseConsent('GRANTED')).toBeNull();
  });
});

describe('regionGroupFromTimeZone', () => {
  it('maps European time zones to the strict opt-in groups', () => {
    expect(regionGroupFromTimeZone('Europe/Berlin')).toBe('eea');
    expect(regionGroupFromTimeZone('Europe/Dublin')).toBe('eea');
    expect(regionGroupFromTimeZone('Europe/London')).toBe('uk');
    expect(regionGroupFromTimeZone('Europe/Zurich')).toBe('switzerland');
  });

  it('separates California and every other region', () => {
    expect(regionGroupFromTimeZone('America/Los_Angeles')).toBe('california');
    expect(regionGroupFromTimeZone('Asia/Karachi')).toBe('other');
    expect(regionGroupFromTimeZone('')).toBe('other');
    expect(regionGroupFromTimeZone(undefined)).toBe('other');
  });
});

describe('needsConsentDecision', () => {
  it('asks when a configured service is still undecided', () => {
    expect(
      needsConsentDecision(
        { analytics: true, advertising: false },
        { analytics: null, advertising: null },
      ),
    ).toBe(true);
  });

  it('does not ask when every configured service has a decision', () => {
    expect(
      needsConsentDecision(
        { analytics: true, advertising: true },
        { analytics: 'denied', advertising: 'granted' },
      ),
    ).toBe(false);
  });

  it('ignores services that are not configured', () => {
    expect(
      needsConsentDecision(
        { analytics: false, advertising: false },
        { analytics: null, advertising: null },
      ),
    ).toBe(false);
    expect(
      needsConsentDecision(
        { analytics: false, advertising: true },
        { analytics: null, advertising: 'denied' },
      ),
    ).toBe(false);
    expect(
      needsConsentDecision(
        { analytics: false, advertising: true },
        { analytics: null, advertising: null },
      ),
    ).toBe(true);
  });
});

describe('consent storage', () => {
  it('keeps analytics and advertising decisions independent', () => {
    setConsent('analytics', 'granted');
    expect(readConsent('analytics')).toBe('granted');
    expect(readConsent('advertising')).toBeNull();

    setConsent('advertising', 'denied');
    expect(readConsent('analytics')).toBe('granted');
    expect(readConsent('advertising')).toBe('denied');
  });

  it('ages out an unknown stored value without throwing', () => {
    const values = installStorage({ [ANALYTICS_CONSENT_KEY]: 'maybe', [ADVERTISING_CONSENT_KEY]: 'denied' });
    expect(readConsent('analytics')).toBeNull();
    expect(readConsent('advertising')).toBe('denied');
    expect(values.get(ADVERTISING_CONSENT_KEY)).toBe('denied');
  });

  it('clears one decision without touching the other', () => {
    setConsent('analytics', 'granted');
    setConsent('advertising', 'granted');

    clearConsent('advertising');

    expect(readConsent('analytics')).toBe('granted');
    expect(readConsent('advertising')).toBeNull();
  });

  it('reports a stable snapshot until a decision changes', () => {
    const first = getConsentSnapshot();
    expect(getConsentSnapshot()).toBe(first);

    setConsent('advertising', 'granted');

    const second = getConsentSnapshot();
    expect(second).not.toBe(first);
    expect(second).toEqual({ analytics: null, advertising: 'granted' });
  });

  it('notifies subscribers only while they are subscribed', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeConsent(listener);

    setConsent('analytics', 'denied');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setConsent('analytics', 'granted');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reads both keys when the snapshot is refreshed', () => {
    installStorage({ [ANALYTICS_CONSENT_KEY]: 'granted', [ADVERTISING_CONSENT_KEY]: 'denied' });
    const snapshot: ConsentSnapshot = getConsentSnapshot();
    expect(snapshot).toEqual<ConsentSnapshot>({ analytics: 'granted', advertising: 'denied' });
  });
});

describe('ConsentState typing seam', () => {
  it('represents undecided consent as null', () => {
    const undecided: ConsentState = null;
    expect(undecided).toBeNull();
  });
});
