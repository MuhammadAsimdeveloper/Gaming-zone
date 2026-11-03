import { useEffect } from 'react';
import type { AdPlacement } from '../../config/site';
import {
  getAdsenseClient,
  getAdSlotId,
  isAdSlotConfigured,
  loadAdsenseScript,
  pushAd,
} from '../../lib/ads';
import { cn } from '../../lib/cn';
import { useConsent } from '../../lib/useConsent';
import { useCatalogue } from '../../providers/CatalogueProvider';

export function AdSlot({ placement, className }: { placement: AdPlacement; className?: string }) {
  const { advertising } = useConsent();
  const { isAdPlacementEnabled } = useCatalogue();
  const enabled = isAdSlotConfigured(placement, advertising) && isAdPlacementEnabled(placement);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void loadAdsenseScript().then(() => {
      if (cancelled) return;
      pushAd();
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, placement]);

  if (!enabled) return null;

  return (
    <aside aria-label="Advertisement" className={cn('w-full', className)}>
      <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        Advertisement
      </p>
      <div className="min-h-[90px] overflow-hidden rounded-2xl border border-line bg-raised/50">
        <ins
          key={placement}
          className="adsbygoogle block"
          style={{ display: 'block' }}
          data-ad-client={getAdsenseClient()}
          data-ad-slot={getAdSlotId(placement)}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
