import { GA_MEASUREMENT_ID } from '../config/site';
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

const CONSENT_KEY = 'neonrift:analytics-consent';
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
  const value = readString(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
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

export function setAnalyticsConsent(consent: AnalyticsConsent): void {
  writeString(CONSENT_KEY, consent);
  if (consent === 'granted') initializeAnalytics();
}

export function clearAnalyticsConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Ignore blocked storage.
  }
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
