import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isAdvertisingConfigured } from '../../lib/ads';
import { isAnalyticsConfigured } from '../../lib/analytics';
import {
  needsConsentDecision,
  regionGroupFromTimeZone,
  setConsent,
  type RegionGroup,
} from '../../lib/consent';
import { useConsent } from '../../lib/useConsent';
import { Button } from '../ui/Button';

const REGION_COPY: Record<RegionGroup, string> = {
  eea: 'You appear to be in a region that requires opt-in consent. Analytics and ads stay off until you allow them.',
  uk: 'You appear to be in a region that requires opt-in consent. Analytics and ads stay off until you allow them.',
  switzerland:
    'You appear to be in a region that requires opt-in consent. Analytics and ads stay off until you allow them.',
  california:
    'California residents: we do not sell or share personal information. Analytics and ads stay off unless you opt in.',
  other: 'Both are off by default everywhere. Allow only what you are comfortable with.',
};

function currentRegion(): RegionGroup {
  try {
    return regionGroupFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return 'other';
  }
}

interface ChoiceProps {
  title: string;
  description: string;
  onAllow: () => void;
  onDecline: () => void;
}

function ConsentChoice({ title, description, onAllow, onDecline }: ChoiceProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-sunken/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" onClick={onDecline}>
          No
        </Button>
        <Button variant="secondary" size="sm" onClick={onAllow}>
          Allow
        </Button>
      </div>
    </div>
  );
}

export function ConsentBanner() {
  const snapshot = useConsent();
  const analyticsConfigured = isAnalyticsConfigured();
  const advertisingConfigured = isAdvertisingConfigured();
  const configured = { analytics: analyticsConfigured, advertising: advertisingConfigured };

  if (!needsConsentDecision(configured, snapshot)) return null;

  const region = currentRegion();
  const analyticsUndecided = analyticsConfigured && snapshot.analytics === null;
  const advertisingUndecided = advertisingConfigured && snapshot.advertising === null;

  function declineRemaining() {
    if (analyticsUndecided) setConsent('analytics', 'denied');
    if (advertisingUndecided) setConsent('advertising', 'denied');
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-6">
      <section
        aria-label="Privacy choices"
        className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-raised/95 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl night:shadow-black/60"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-mint/20 bg-mint/10 text-mint">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Your privacy choices</p>
            <p className="mt-1 text-xs leading-5 text-muted">{REGION_COPY[region]}</p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {analyticsUndecided ? (
            <ConsentChoice
              title="Optional analytics"
              description="Counts page views and game launches so we know what is working. No accounts or personal profiles."
              onAllow={() => setConsent('analytics', 'granted')}
              onDecline={() => setConsent('analytics', 'denied')}
            />
          ) : null}
          {advertisingUndecided ? (
            <ConsentChoice
              title="Optional advertising"
              description="Loads Google AdSense, which may use cookies or device identifiers. No ad script loads before you allow it."
              onAllow={() => setConsent('advertising', 'granted')}
              onDecline={() => setConsent('advertising', 'denied')}
            />
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={declineRemaining}
            className="text-xs font-medium text-muted underline underline-offset-2 transition hover:text-ink"
          >
            Keep both off
          </button>
          <Link
            to="/privacy"
            className="text-xs font-medium text-brand underline underline-offset-2"
          >
            Read the privacy policy
          </Link>
        </div>
      </section>
    </div>
  );
}
