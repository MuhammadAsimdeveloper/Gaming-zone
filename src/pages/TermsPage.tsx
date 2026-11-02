import { LegalPage, LegalSection } from '../components/legal/LegalPage';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      description="The ground rules for using NeonRift, playing its games and interacting with advertising or third-party content."
      path="/terms"
      updated="2 November 2026"
    >
      <LegalSection id="acceptance" title="1. Acceptance">
        <p>
          By using NeonRift you agree to these terms. If you do not agree, please stop using the
          site. The operator may update these terms as the platform evolves; the &ldquo;last
          updated&rdquo; date above will change when that happens.
        </p>
      </LegalSection>

      <LegalSection id="service" title="2. The service">
        <p>
          NeonRift provides free browser games that run locally in your browser. The service is
          offered as-is, with no guarantee of uninterrupted availability. Games or features may be
          added, changed or removed at any time.
        </p>
        <p>
          No account is required. Features that rely on local storage only work in the browser where
          you used them and may be lost if you clear site data or use private browsing.
        </p>
      </LegalSection>

      <LegalSection id="license" title="3. Personal use license">
        <p>
          Unless a game states otherwise, NeonRift&apos;s original games and site content are
          provided for personal, non-commercial entertainment. You may play them in your browser. You
          may not copy, redistribute, resell, sublicense or deploy the games or site code as your own
          without written permission.
        </p>
        <p>
          Third-party games, if linked or embedded, remain the property of their owners and are
          subject to their licenses. No unauthorized embedding is permitted.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Attempt to break, overload or bypass the site, its games or security controls.</li>
          <li>Use automated tools to generate ad impressions, clicks or fake engagement.</li>
          <li>Extract, scrape or republish content at scale without permission.</li>
          <li>Upload or transmit malicious code through any interactive feature.</li>
          <li>Use the site to harass others, infringe intellectual property or break the law.</li>
        </ul>
      </LegalSection>

      <LegalSection id="advertising" title="5. Advertising">
        <p>
          The site may display clearly labelled advertisements if the operator enables a real ad
          integration. Ads must never cover game controls or be disguised as game content. You agree
          not to manipulate ad delivery. Advertisers are responsible for their own offers and
          landing pages.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="6. Availability and changes">
        <p>
          We aim for a reliable experience but do not promise that every game works on every device,
          browser or network. Performance depends on your hardware and GPU. We may suspend features
          for maintenance or remove content that no longer meets our standards.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" title="7. Disclaimers">
        <p>
          To the maximum extent permitted by law, NeonRift is provided &ldquo;as is&rdquo; and
          &ldquo;as available&rdquo; without warranties of any kind, express or implied, including
          merchantability, fitness for a particular purpose and non-infringement. Nothing on the site
          is professional, legal, medical or financial advice.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="8. Limitation of liability">
        <p>
          To the maximum extent permitted by law, the operator is not liable for indirect,
          incidental, special, consequential or punitive damages, or for lost data or lost profits,
          arising from your use of the site. Because the service is free, the operator&apos;s total
          liability is limited to the greatest extent the law allows.
        </p>
        <p>
          Some jurisdictions do not allow certain exclusions, so parts of this section may not apply
          to you.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="9. Intellectual property">
        <p>
          Names, logos, artwork and original code on NeonRift are protected by intellectual property
          law. All trademarks referenced remain the property of their owners. If you believe content
          infringes your rights, contact us with the details and supporting evidence.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title="10. Governing law">
        <p>
          These terms are governed by the laws applicable to the site operator&apos;s place of
          establishment, without regard to conflict-of-law rules. Before starting formal proceedings,
          please contact us so we can try to resolve the issue informally.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="11. Contact">
        <p>
          Questions about these terms can be sent through the{' '}
          <a className="text-electric-300 underline underline-offset-2" href="/contact">
            contact page
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
