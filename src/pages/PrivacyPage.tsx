import { useEffect, useState } from 'react';
import { LegalPage, LegalSection } from '../components/legal/LegalPage';
import { Button } from '../components/ui/Button';
import { GA_MEASUREMENT_ID } from '../config/site';
import {
  clearAnalyticsConsent,
  getAnalyticsConsent,
  isAnalyticsConfigured,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from '../lib/analytics';
import { usePreferences } from '../providers/PreferencesProvider';
import { useToast } from '../providers/ToastProvider';

export default function PrivacyPage() {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(() => getAnalyticsConsent());
  const { favorites, recentlyPlayed, clearRecentlyPlayed } = usePreferences();
  const { showToast } = useToast();

  useEffect(() => {
    setConsent(getAnalyticsConsent());
  }, []);

  function choose(value: AnalyticsConsent) {
    setAnalyticsConsent(value);
    setConsent(value);
    showToast(value === 'granted' ? 'Analytics enabled' : 'Analytics declined');
  }

  function withdraw() {
    clearAnalyticsConsent();
    setConsent(null);
    showToast('Analytics preference cleared');
  }

  return (
    <LegalPage
      title="Privacy Policy"
      description="What NeonRift stores, what it does not collect, and the choices you have over local data and analytics."
      path="/privacy"
      updated="2 November 2026"
    >
      <LegalSection id="summary" title="The short version">
        <p>
          NeonRift is a static website. There are no user accounts, no database of players and no
          server-side profiles. Favorites, recently played entries and preferences are stored in your
          own browser&apos;s local storage. Optional analytics only load if a measurement ID is
          configured and you explicitly allow them.
        </p>
      </LegalSection>

      <LegalSection id="local-data" title="Data stored in your browser">
        <p>
          The following values may be written to local storage on this device. They are readable by
          this site in your browser and are not transmitted to us by default:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Favorites</strong> — the IDs of games you saved. Currently{' '}
            {favorites.length}.
          </li>
          <li>
            <strong className="text-ink">Recently played</strong> — game IDs and timestamps of your
            last launches. Currently {recentlyPlayed.length} entries.
          </li>
          <li>
            <strong className="text-ink">Analytics consent</strong> — your granted or declined
            choice, so we do not ask again.
          </li>
          <li>
            <strong className="text-ink">Admin preview state</strong> — local-only catalogue edits
            made in the development admin. Never uploaded.
          </li>
          <li>
            <strong className="text-ink">Game saves</strong> — best scores and simple progress for
            individual games, when a game supports them.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="analytics" title="Optional analytics">
        <p>
          If the operator configures a Google Analytics 4 measurement ID, a consent banner appears.
          Nothing is sent to Google until you choose &ldquo;Allow analytics&rdquo;. When enabled, we
          send page views and interaction events such as game launches, completed runs, searches,
          favorites and shares. The configuration requests IP anonymisation, disables Google Signals
          and ad personalisation, and does not collect names, emails or precise location.
        </p>
        {isAnalyticsConfigured() ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-medium text-ink">Your analytics choice</p>
            <p className="mt-1 text-sm text-muted">
              Current status:{' '}
              <strong className="text-ink">
                {consent === 'granted'
                  ? 'allowed'
                  : consent === 'denied'
                    ? 'declined'
                    : 'not set'}
              </strong>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => choose('granted')} disabled={consent === 'granted'}>
                Allow analytics
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => choose('denied')}
                disabled={consent === 'denied'}
              >
                Decline
              </Button>
              <Button size="sm" variant="ghost" onClick={withdraw}>
                Clear choice
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted/70">
              Measurement ID configured: <code className="text-[11px]">{GA_MEASUREMENT_ID}</code>.
              Clearing your choice stops future automatic loading, but a script already loaded on
              this page may remain active until you reload.
            </p>
          </div>
        ) : (
          <p className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm">
            No analytics measurement ID is configured in this build, so no analytics script is
            loaded at all.
          </p>
        )}
      </LegalSection>

      <LegalSection id="advertising" title="Advertising">
        <p>
          Advertising is disabled by default. When the operator enables it with a real approved
          publisher configuration, ad slots may use Google AdSense or Google H5 Games Ads. Those
          providers may use cookies or device identifiers under their own policies. We will not
          place ads over game controls, disguise ads as game content or trigger accidental clicks.
        </p>
        <p>
          Embedded third-party games, if any are ever approved, have their own privacy practices. We
          only consider games from allowlisted HTTPS origins and never pass user data to them.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>
          NeonRift itself does not set advertising or tracking cookies. Local storage is used for the
          preferences described above. Optional analytics and advertising providers may set their
          own cookies only after the relevant configuration and consent are in place.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <p>
          NeonRift is a general-audience gaming site. We do not knowingly collect personal
          information from anyone, including children. If a game or ad integration would require
          additional age gates, it will not be enabled without the appropriate configuration.
        </p>
      </LegalSection>

      <LegalSection id="choices" title="Your choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>Clear your browser storage to remove favorites, history and game saves.</li>
          <li>Use the control above to change or withdraw analytics consent.</li>
          <li>Use the button below to clear your recently played list now.</li>
          <li>Block third-party scripts with a browser extension if you prefer.</li>
        </ul>
        <div className="pt-2">
          <Button variant="secondary" size="sm" onClick={clearRecentlyPlayed}>
            Clear recently played ({recentlyPlayed.length})
          </Button>
        </div>
      </LegalSection>

      <LegalSection id="retention" title="Retention and security">
        <p>
          Local data stays until you delete it or clear browser storage. Because NeoRift has no
          account system, there is no server-side profile to delete. We keep the site static and
          avoid collecting data we do not need.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Privacy questions can be sent to the operator using the details on the{' '}
          <a className="text-electric-300 underline underline-offset-2" href="/contact">
            contact page
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
