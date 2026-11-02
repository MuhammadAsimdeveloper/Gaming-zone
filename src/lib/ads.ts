import {
  ADS_ENABLED,
  ADSENSE_CLIENT,
  AD_SLOT_IDS,
  type AdPlacement,
} from '../config/site';
import { getConsentSnapshot, type ConsentState } from './consent';

export interface AdvertisingGate {
  enabled: boolean;
  client: string;
  slotId: string;
  consent: ConsentState;
}

export function advertisingAllowed({ enabled, client, slotId, consent }: AdvertisingGate): boolean {
  return enabled && Boolean(client) && Boolean(slotId) && consent === 'granted';
}

export function isAdvertisingConfigured(): boolean {
  return ADS_ENABLED && Boolean(ADSENSE_CLIENT) && Object.values(AD_SLOT_IDS).some(Boolean);
}

export function isAdSlotConfigured(placement: AdPlacement, consent: ConsentState): boolean {
  return advertisingAllowed({
    enabled: ADS_ENABLED,
    client: ADSENSE_CLIENT,
    slotId: AD_SLOT_IDS[placement],
    consent,
  });
}

export function getAdSlotId(placement: AdPlacement): string {
  return AD_SLOT_IDS[placement];
}

export function getAdsenseClient(): string {
  return ADSENSE_CLIENT;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let adsenseLoader: Promise<void> | null = null;

export function loadAdsenseScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (getConsentSnapshot().advertising !== 'granted') return Promise.resolve();
  if (!isAdvertisingConfigured()) return Promise.resolve();
  if (adsenseLoader) return adsenseLoader;

  adsenseLoader = new Promise((resolve) => {
    if (document.querySelector('script[data-neonrift-adsense]')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(getAdsenseClient())}`;
    script.dataset.neonriftAdsense = 'true';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return adsenseLoader;
}

export function pushAd(): void {
  try {
    window.adsbygoogle = window.adsbygoogle ?? [];
    window.adsbygoogle.push({});
  } catch {
    // AdSense refused the fill; keep the page clean with no placeholder ad.
  }
}

/** Stops future ad requests when consent is withdrawn. A reload may be needed to clear an already-loaded provider. */
export function resetAdsense(): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('script[data-neonrift-adsense]').forEach((script) => script.remove());
  adsenseLoader = null;
  if (typeof window !== 'undefined') window.adsbygoogle = [];
}

/*
 * Rewarded ads are intentionally not implemented. This is the integration seam a
 * future provider (for example Google H5 Games Ads) should fill in. It never
 * fabricates a reward or simulates an ad.
 */
export type RewardedAdResult = 'rewarded' | 'skipped' | 'unavailable';

export interface RewardedAdProvider {
  isAvailable(): boolean;
  requestReward(placement: string): Promise<RewardedAdResult>;
}

export const rewardedAds: RewardedAdProvider = {
  isAvailable: () => false,
  requestReward: async () => 'unavailable',
};
