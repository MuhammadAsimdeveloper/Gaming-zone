import { GA_MEASUREMENT_ID } from '../config/site';
import { readConsent } from './consent';
import { readString, writeString } from './storage';

export type AnalyticsConsent = 'granted' | 'denied';

export type AnalyticsEventName =
  | 'page_view'
  | 'game_launch'
  | 'game_complete'
  | 'game_restart'
  | 'search'
  | 'favorite'
  | 'share'
  | 'returning_user';

const VISITOR_KEY = 'neonrift:visitor';

let initialized = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(GA_MEASUREMENT_ID);
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  return readConsent('analytics');
}

function reportReturningUser(): void {
  const now = Date.now();
  const raw = readString(VISITOR_KEY);

  if (!raw) {
    writeString(VISITOR_KEY, JSON.stringify({ firstSeen: now, lastSeen: now }));
    return;
  }

  try {
    const parsed = JSON.parse(raw) as { firstSeen?: number; lastSeen?: number };
    const firstSeen = typeof parsed.firstSeen === 'number' ? parsed.firstSeen : now;
    const days = Math.max(0, Math.round((now - firstSeen) / 86_400_000));
    window.gtag?.('event', 'returning_user', { days_since_first_visit: days });
    writeString(VISITOR_KEY, JSON.stringify({ firstSeen, lastSeen: now }));
  } catch {
    writeString(VISITOR_KEY, JSON.stringify({ firstSeen: now, lastSeen: now }));
  }
}

export function initializeAnalytics(): void {
  if (initialized || !isAnalyticsConfigured() || getAnalyticsConsent() !== 'granted') return;

  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  script.dataset.neonriftAnalytics = 'true';
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  reportReturningUser();
}

/** Stops future analytics requests when consent is withdrawn. A reload may be needed to clear provider cookies. */
export function resetAnalytics(): void {
  if (typeof window === 'undefined') return;
  document.querySelectorAll('script[data-neonrift-analytics]').forEach((script) => script.remove());
  delete window.gtag;
  delete window.dataLayer;
  initialized = false;
}

export function track(name: AnalyticsEventName, params: Record<string, unknown> = {}): void {
  if (!isAnalyticsConfigured() || getAnalyticsConsent() !== 'granted') return;
  if (!initialized) initializeAnalytics();
  window.gtag?.('event', name, params);
}

export function trackPageView(path: string, title: string): void {
  track('page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
  });
}
