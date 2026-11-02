import { Check, Copy, Mail, MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';
import { Seo } from '../components/seo/Seo';
import { Button, ButtonLink } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { PageHeader } from '../components/ui/PageHeader';
import { CONTACT_EMAIL } from '../config/site';
import { useToast } from '../providers/ToastProvider';

const topics = [
  {
    title: 'Game submissions',
    body: 'Developers can pitch a browser game for the library. Include a playable build, the engine it uses and its license terms.',
  },
  {
    title: 'Bug reports',
    body: 'Tell us the game, device and browser. A short description of what happened is more useful than a screenshot alone.',
  },
  {
    title: 'Partnerships',
    body: 'Sponsored games and rewarded-ad integrations are planned. We only discuss placements that keep gameplay fair and clearly labelled.',
  },
];

export default function ContactPage() {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  async function copyEmail() {
    if (!CONTACT_EMAIL) return;
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      showToast('Email address copied');
    } catch {
      showToast('Copy failed — select the address manually');
    }
  }

  return (
    <>
      <Seo
        title="Contact NeonRift"
        description="Reach the NeonRift team about game submissions, bug reports, partnerships or anything else."
        path="/contact"
      />
      <PageHeader
        eyebrow="Contact"
        title="Talk to the people behind the rift"
        description="A small independent team runs NeonRift. We read every message, but we cannot promise an instant reply."
      />

      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Direct email</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              The most reliable way to reach us. Use a clear subject line so your message lands in
              the right place.
            </p>

            {CONTACT_EMAIL ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-electric-500/12 text-electric-300">
                    <Mail className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted/60">Email</p>
                    <p className="truncate text-sm font-medium text-ink">{CONTACT_EMAIL}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink to={`mailto:${CONTACT_EMAIL}`} size="sm">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Open mail app
                  </ButtonLink>
                  <Button variant="secondary" size="sm" onClick={copyEmail}>
                    {copied ? (
                      <Check className="h-4 w-4 text-mint" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                    {copied ? 'Copied' : 'Copy address'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5 text-sm leading-6 text-amber-100/80">
                <p className="font-medium text-amber-100">Contact email not configured</p>
                <p className="mt-2">
                  This build has no public contact address. Set{' '}
                  <code className="rounded bg-black/30 px-1.5 py-0.5 text-[12px]">
                    VITE_CONTACT_EMAIL
                  </code>{' '}
                  in your environment and rebuild. The form is hidden deliberately rather than
                  pretending to send messages.
                </p>
              </div>
            )}

            <div className="mt-8 space-y-4">
              {topics.map((topic) => (
                <div key={topic.title} className="rounded-2xl border border-white/[0.07] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <MessageSquare className="h-4 w-4 text-plasma-300" aria-hidden="true" />
                    {topic.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{topic.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold text-ink">What to include</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Clear, complete messages get faster answers. There is no ticket queue and no chatbot
              on the other side.
            </p>
            <ul className="mt-6 space-y-4 text-sm leading-6 text-muted">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-400" />
                <span>
                  <strong className="font-medium text-ink">Game reports:</strong> game title, device,
                  browser version, and the steps that led to the problem.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-400" />
                <span>
                  <strong className="font-medium text-ink">Submissions:</strong> a URL to your game
                  or build, technical requirements, and proof that you own or are licensed to
                  distribute it.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-400" />
                <span>
                  <strong className="font-medium text-ink">Privacy requests:</strong> tell us which
                  data you are asking about. We keep platform data minimal by design.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-400" />
                <span>
                  <strong className="font-medium text-ink">Abuse:</strong> include the game URL and a
                  concise description. Do not send personal data about other people.
                </span>
              </li>
            </ul>
            <p className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-xs leading-6 text-muted">
              We do not offer an embedded contact form because this is a static site. A form that
              silently fails or pretends to send mail would be worse than an honest mail link.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
