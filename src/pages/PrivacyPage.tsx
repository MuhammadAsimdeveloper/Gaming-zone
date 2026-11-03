import { LegalPage, LegalSection } from '../components/legal/LegalPage';
import { Button } from '../components/ui/Button';
import { GA_MEASUREMENT_ID } from '../config/site';
import { isAdvertisingConfigured } from '../lib/ads';
import { isAnalyticsConfigured } from '../lib/analytics';
import {
  clearConsent,
  regionGroupFromTimeZone,
  setConsent,
  type ConsentCategory,
  type RegionGroup,
} from '../lib/consent';
import { useConsent } from '../lib/useConsent';
import { usePreferences } from '../providers/PreferencesProvider';
import { useToast } from '../providers/ToastProvider';

const REGION_LABEL: Record<RegionGroup, string> = {
  eea: 'European Economic Area',
  uk: 'United Kingdom',
  switzerland: 'Switzerland',
  california: 'California',
  other: 'another region',
};

function currentRegion(): RegionGroup {
  try {
    return regionGroupFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return 'other';
  }
}

export default function PrivacyPage() {
  const snapshot = useConsent();
  const { favorites, recentlyPlayed, clearRecentlyPlayed } = usePreferences();
  const { showToast } = useToast();
  const analyticsConfigured = isAnalyticsConfigured();
  const advertisingConfigured = isAdvertisingConfigured();
  const region = currentRegion();

  function choose(category: ConsentCategory, decision: 'granted' | 'denied') {
    setConsent(category, decision);
    showToast(
      `${category === 'analytics' ? 'Analytics' : 'Advertising'} ${
        decision === 'granted' ? 'enabled' : 'declined'
      }`,
    );
  }

  function withdraw(category: ConsentCategory) {
    clearConsent(category);
    showToast(
      `${category === 'analytics' ? 'Analytics' : 'Advertising'} choice cleared. Reload the page to clear any provider cookies that were already set.`,
    );
  }

  return (
    <LegalPage
      title="Privacy Policy"
      description="What NeonRift stores, what it does not collect, and the separate choices you have over local data, analytics and advertising."
      path="/privacy"
      updated="2 November 2026"
    >
      <LegalSection id="summary" title="The short version">
        <p>
          NeonRift is a static website. There are no user accounts, no database of players and no
          server-side profiles. Favorites, recently played entries and preferences are stored in your
          own browser&apos;s local storage. Optional analytics and advertising are off by default and
          stay off until you explicitly allow them.
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
            <strong className="text-ink">Analytics consent</strong> — your separate granted or
            declined choice, if analytics is configured.
          </li>
          <li>
            <strong className="text-ink">Advertising consent</strong> — your separate granted or
            declined choice, if advertising is configured.
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
          Nothing is sent to Google until you choose to allow analytics. When enabled, we send page
          views and interaction events such as game launches, completed runs, searches, favorites and
          shares. The configuration requests IP anonymisation, disables Google Signals and ad
          personalisation, and does not collect names, emails or precise location.
        </p>
        {analyticsConfigured ? (
          <div className="rounded-2xl border border-line bg-raised p-5">
            <p className="text-sm font-medium text-ink">Your analytics choice</p>
            <p className="mt-1 text-sm text-muted">
              Current status:{' '}
              <strong className="text-ink">
                {snapshot.analytics === 'granted'
                  ? 'allowed'
                  : snapshot.analytics === 'denied'
                    ? 'declined'
                    : 'not set'}
              </strong>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => choose('analytics', 'granted')}
                disabled={snapshot.analytics === 'granted'}
              >
                Allow analytics
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => choose('analytics', 'denied')}
                disabled={snapshot.analytics === 'denied'}
              >
                Decline analytics
              </Button>
              <Button size="sm" variant="ghost" onClick={() => withdraw('analytics')}>
                Clear choice
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Measurement ID configured: <code className="text-[11px]">{GA_MEASUREMENT_ID}</code>.
              Clearing your choice removes the analytics script from this page and stops future
              events. A reload is required to clear provider cookies that were already set.
            </p>
          </div>
        ) : (
          <p className="rounded-2xl border border-line bg-raised p-4 text-sm">
            No analytics measurement ID is configured in this build, so no analytics script is
            loaded at all.
          </p>
        )}
      </LegalSection>

      <LegalSection id="advertising" title="Advertising">
        <p>
          Advertising is disabled by default. Even when an operator configures a real approved
          publisher account, no ad script is requested until you separately allow advertising.
          Google AdSense may then use cookies or device identifiers under its own policies. We do not
          place ads over game controls, disguise ads as game content or trigger accidental clicks.
        </p>
        {advertisingConfigured ? (
          <div className="rounded-2xl border border-line bg-raised p-5">
            <p className="text-sm font-medium text-ink">Your advertising choice</p>
            <p className="mt-1 text-sm text-muted">
              Current status:{' '}
              <strong className="text-ink">
                {snapshot.advertising === 'granted'
                  ? 'allowed'
                  : snapshot.advertising === 'denied'
                    ? 'declined'
                    : 'not set'}
              </strong>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => choose('advertising', 'granted')}
                disabled={snapshot.advertising === 'granted'}
              >
                Allow advertising
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => choose('advertising', 'denied')}
                disabled={snapshot.advertising === 'denied'}
              >
                Decline advertising
              </Button>
              <Button size="sm" variant="ghost" onClick={() => withdraw('advertising')}>
                Clear choice
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Withdrawing removes ad slots and stops new ad requests. A reload is required to remove
              Google scripts and cookies that were already loaded.
            </p>
          </div>
        ) : (
          <p className="rounded-2xl border border-line bg-raised p-4 text-sm">
            No ad client is configured in this build, so no ad script or ad request is made even if
            advertising is enabled in the codebase.
          </p>
        )}
        <p>
          Embedded third-party games, if any are ever approved, have their own privacy practices. We
          only consider games from allowlisted HTTPS origins and never pass user data to them.
        </p>
      </LegalSection>

      <LegalSection id="regions" title="Regions and your rights">
        <p>
          We ask every visitor to opt in, regardless of location. That is stricter than a simple
          opt-out and means the same protections apply everywhere. Your browser time zone suggests
          you are in or near <strong className="text-ink">{REGION_LABEL[region]}</strong>. This is a
          best-effort hint for the explanatory text, not a legal determination.
        </p>
        <p>
          If you are in the European Economic Area, the United Kingdom or Switzerland, you have
          rights to access, correct, delete and object to processing of personal data. If you are a
          California resident, we do not sell or share personal information; analytics and ads stay
          off unless you opt in. Because NeonRift has no account system, most data never leaves your
          browser. Use the controls on this page or clear your browser storage to exercise these
          choices.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>
          NeonRift itself does not set advertising or tracking cookies. Local storage is used for the
          preferences described above. Google Analytics and Google AdSense may set their own cookies
          only after you allow the corresponding category. Declining or clearing a choice stops new
          requests; a reload removes scripts that were already loaded on the page.
        </p>
      </LegalSection>

      <LegalSection id="fonts" title="Fonts and hosting">
        <p>
          The Inter and Space Grotesk font files are served from this site's own origin and are
          licensed under the SIL Open Font License. Loading a page does not contact Google Fonts or
          any other font CDN, so your IP address is not shared with a font provider.
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
          <li>
            Use the analytics and advertising controls above to change or withdraw either choice
            independently.
          </li>
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
          Local data stays until you delete it or clear browser storage. Because NeonRift has no
          account system, there is no server-side profile to delete. We keep the site static and
          avoid collecting data we do not need. No admin dashboard is shipped in this build, so no
          passcode is used to protect server data.
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
