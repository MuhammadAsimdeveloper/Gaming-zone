import { useSyncExternalStore } from 'react';
import { getConsentSnapshot, subscribeConsent, type ConsentSnapshot } from './consent';

export function useConsent(): ConsentSnapshot {
  return useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentSnapshot);
}
