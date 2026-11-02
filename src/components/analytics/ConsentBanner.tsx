import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAnalyticsConsent,
  isAnalyticsConfigured,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from '../../lib/analytics';
import { Button } from '../ui/Button';

export function ConsentBanner() {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(() => getAnalyticsConsent());

  if (!isAnalyticsConfigured() || consent) return null;

  function choose(value: AnalyticsConsent) {
    setAnalyticsConsent(value);
    setConsent(value);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-white/12 bg-night-850/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl sm:flex-row sm:items-center sm:gap-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-mint/20 bg-mint/10 text-mint">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-sm leading-6 text-muted">
            Optional analytics help us see which games people enjoy. No accounts, no ad tracking, and
            you can change your mind anytime. Read our{' '}
            <Link to="/privacy" className="font-medium text-electric-300 underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <Button variant="ghost" size="sm" onClick={() => choose('denied')}>
            Decline
          </Button>
          <Button size="sm" onClick={() => choose('granted')}>
            Allow analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
