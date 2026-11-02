import {
  ADS_ENABLED,
  ADSENSE_CLIENT,
  AD_SLOT_IDS,
  type AdPlacement,
} from '../config/site';

export function isAdSlotConfigured(placement: AdPlacement): boolean {
  return ADS_ENABLED && Boolean(ADSENSE_CLIENT) && Boolean(AD_SLOT_IDS[placement]);
}

export function getAdSlotId(placement: AdPlacement): string {
  return AD_SLOT_IDS[placement];
}

export function getAdsenseClient(): string {
  return ADSENSE_CLIENT;
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
