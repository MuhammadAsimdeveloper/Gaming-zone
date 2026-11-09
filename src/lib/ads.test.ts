import { describe, expect, it } from 'vitest';
import { AD_PLACEMENTS } from '../config/site';
import { advertisingAllowed, isAdSlotConfigured, isAdvertisingConfigured } from './ads';

const base = {
  enabled: true,
  client: 'ca-pub-0000000000000000',
  slotId: '1234567890',
  consent: 'granted' as const,
};

describe('advertisingAllowed', () => {
  it('allows an ad only when configuration and explicit consent are both present', () => {
    expect(advertisingAllowed(base)).toBe(true);
  });

  it('never allows an ad before the visitor grants advertising consent', () => {
    expect(advertisingAllowed({ ...base, consent: null })).toBe(false);
    expect(advertisingAllowed({ ...base, consent: 'denied' })).toBe(false);
  });

  it('stays disabled when the build flag, client or slot is missing', () => {
    expect(advertisingAllowed({ ...base, enabled: false })).toBe(false);
    expect(advertisingAllowed({ ...base, client: '' })).toBe(false);
    expect(advertisingAllowed({ ...base, slotId: '' })).toBe(false);
  });
});

describe('shipped default build', () => {
  it('never renders an ad placement, even with consent, until a build supplies a client and slots', () => {
    expect(isAdvertisingConfigured()).toBe(false);
    for (const placement of AD_PLACEMENTS) {
      expect(isAdSlotConfigured(placement, 'granted')).toBe(false);
    }
  });
});
