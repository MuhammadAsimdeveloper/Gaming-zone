import { readString, writeString } from './storage';

export type ConsentDecision = 'granted' | 'denied';
export type ConsentState = ConsentDecision | null;
export type ConsentCategory = 'analytics' | 'advertising';

export interface ConsentSnapshot {
  analytics: ConsentState;
  advertising: ConsentState;
}

export const ANALYTICS_CONSENT_KEY = 'neonrift:analytics-consent';
export const ADVERTISING_CONSENT_KEY = 'neonrift:advertising-consent';

const KEYS: Record<ConsentCategory, string> = {
  analytics: ANALYTICS_CONSENT_KEY,
  advertising: ADVERTISING_CONSENT_KEY,
};

export type RegionGroup = 'eea' | 'uk' | 'switzerland' | 'california' | 'other';

const listeners = new Set<() => void>();
let cachedSnapshot: ConsentSnapshot | null = null;
let storageListenerAttached = false;

export function parseConsent(value: string | null): ConsentState {
  return value === 'granted' || value === 'denied' ? value : null;
}

function readSnapshot(): ConsentSnapshot {
  return {
    analytics: parseConsent(readString(ANALYTICS_CONSENT_KEY)),
    advertising: parseConsent(readString(ADVERTISING_CONSENT_KEY)),
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== ANALYTICS_CONSENT_KEY && event.key !== ADVERTISING_CONSENT_KEY) return;
  refreshConsent();
}

/**
 * Best-effort browser-timezone hint only. The site asks every visitor to opt in,
 * so this changes the explanatory copy rather than weakening any requirement.
 */
export function regionGroupFromTimeZone(timeZone: string | undefined): RegionGroup {
  const zone = timeZone?.trim();
  if (!zone) return 'other';
  if (zone === 'Europe/London') return 'uk';
  if (zone === 'Europe/Zurich' || zone === 'Europe/Vaduz') return 'switzerland';
  if (zone === 'America/Los_Angeles') return 'california';
  if (
    zone.startsWith('Europe/') ||
    zone === 'Atlantic/Canary' ||
    zone === 'Atlantic/Madeira' ||
    zone === 'Atlantic/Reykjavik' ||
    zone === 'Atlantic/Faroe'
  ) {
    return 'eea';
  }
  return 'other';
}

export function needsConsentDecision(
  configured: { analytics: boolean; advertising: boolean },
  snapshot: ConsentSnapshot,
): boolean {
  return (
    (configured.analytics && snapshot.analytics === null) ||
    (configured.advertising && snapshot.advertising === null)
  );
}

export function getConsentSnapshot(): ConsentSnapshot {
  cachedSnapshot ??= readSnapshot();
  return cachedSnapshot;
}

export function refreshConsent(): void {
  cachedSnapshot = null;
  emit();
}

export function readConsent(category: ConsentCategory): ConsentState {
  return parseConsent(readString(KEYS[category]));
}

export function setConsent(category: ConsentCategory, decision: ConsentDecision): void {
  writeString(KEYS[category], decision);
  refreshConsent();
}

export function clearConsent(category: ConsentCategory): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEYS[category]);
  } catch {
    // Ignore blocked storage; the snapshot refresh still updates this tab.
  }
  refreshConsent();
}

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageListenerAttached && typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('storage', onStorage);
    storageListenerAttached = true;
  }
  return () => {
    listeners.delete(listener);
  };
}
