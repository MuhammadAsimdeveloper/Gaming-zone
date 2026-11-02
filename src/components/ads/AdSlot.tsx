import { useEffect } from 'react';
import type { AdPlacement } from '../../config/site';
import { getAdsenseClient, getAdSlotId, isAdSlotConfigured } from '../../lib/ads';
import { cn } from '../../lib/cn';
import { useCatalogue } from '../../providers/CatalogueProvider';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let adsenseLoader: Promise<void> | null = null;

function loadAdsenseScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
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

export function AdSlot({ placement, className }: { placement: AdPlacement; className?: string }) {
  const { isAdPlacementEnabled } = useCatalogue();
  const enabled = isAdSlotConfigured(placement) && isAdPlacementEnabled(placement);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void loadAdsenseScript().then(() => {
      if (cancelled) return;
      try {
        window.adsbygoogle = window.adsbygoogle ?? [];
        window.adsbygoogle.push({});
      } catch {
        // AdSense refused the fill; keep the page clean with no placeholder ad.
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, placement]);

  if (!enabled) return null;

  return (
    <aside aria-label="Advertisement" className={cn('w-full', className)}>
      <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-muted/50">
        Advertisement
      </p>
      <div className="min-h-[90px] overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.015]">
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
