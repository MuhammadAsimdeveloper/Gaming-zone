import { Code2, Heart, MousePointerClick, Rocket, ShieldCheck, Zap } from 'lucide-react';
import { Seo } from '../components/seo/Seo';
import { ButtonLink } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { CtaBand } from '../components/ui/CtaBand';
import { PageHeader } from '../components/ui/PageHeader';
import { useCatalogue } from '../providers/CatalogueProvider';

const values = [
  {
    icon: Code2,
    title: 'Original first',
    body: 'Every game is written for NeonRift. No copied ROMs, no re-skinned templates, no unauthorized embeds dressed up as originals.',
  },
  {
    icon: Zap,
    title: 'Instant by default',
    body: 'Games are lazy-loaded only when you open them. The catalogue stays light so you spend time playing, not waiting.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest by design',
    body: 'Real game counts. No invented ratings. Ads stay off until they are configured, and every insight is opt-in.',
  },
];

const steps = [
  {
    icon: MousePointerClick,
    title: 'Pick a game',
    body: 'Browse the library, search by name or filter by genre. Each card shows the real category and controls.',
  },
  {
    icon: Rocket,
    title: 'Play instantly',
    body: 'Original games start in the page. No download, no account and no launcher in between you and the game.',
  },
  {
    icon: Heart,
    title: 'Keep what you like',
    body: 'Favorites and play history live in your browser. Save a few and the homepage picks start to match your taste.',
  },
];

export default function AboutPage() {
  const { publishedGames, visibleCategories, categoryCounts } = useCatalogue();
  const liveCategories = visibleCategories.filter(
    (category) => (categoryCounts[category.id] ?? 0) > 0,
  ).length;

  return (
    <>
      <Seo
        title="About NeonRift"
        description="Why NeonRift exists: a small, honest browser games library with original games, instant play and no fake statistics."
        path="/about"
      />
      <PageHeader
        eyebrow="About"
        title="A small library with a sharp edge."
        description="NeonRift is an independent browser gaming project built around a simple bet: a handful of genuinely good original games beats a maze of redirects and inflated play counts."
      />

      <Container className="py-12 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-14">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { value: String(publishedGames.length), label: 'Original games published' },
              { value: String(liveCategories), label: 'Genres with live games' },
              { value: '0', label: 'Accounts required' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-line bg-raised/60 p-5"
              >
                <p className="font-display text-3xl font-semibold text-ink">{stat.value}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">Why NeonRift exists</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted">
              <p>
                Most free game portals are built to maximise page views: autoplay videos, pop-ups,
                three redirects before the game starts and counters that do not mean anything. That
                experience is bad for players and, in the long run, bad for the games.
              </p>
              <p>
                NeonRift starts from the other end. Build a small number of original games, make them
                load fast, describe them accurately, and let the library grow only as fast as it can
                be done well. If a feature is not ready, it is labelled as not ready.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">What the library stands for</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {values.map((value) => (
                <div
                  key={value.title}
                  className="rounded-2xl border border-line bg-raised/60 p-5"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
                    <value.icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-ink">{value.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-muted">{value.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">How it works</h2>
            <ol className="mt-5 space-y-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-line bg-raised/40 p-5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-plasma-500/20 bg-plasma-500/10 text-plasma-300">
                    <step.icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      <span className="mr-2 text-xs font-semibold text-muted">0{index + 1}</span>
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-6 text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">Where it is going</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
              <p>
                The next milestones are more original games, sharper accessibility and optional,
                clearly labelled partner games only where a written licence allows embedding.
              </p>
              <p>
                Advertising is prepared but switched off. If it is enabled later, it will fund the
                library without covering controls or inventing clicks. There are no revenue counters
                here because there is nothing to inflate yet.
              </p>
              <p>
                Questions or a game idea? <ButtonLink to="/contact" variant="ghost" size="sm" className="h-auto px-1 py-0 align-baseline">Get in touch</ButtonLink>.
              </p>
            </div>
          </section>
        </div>
      </Container>

      <CtaBand
        title="Enough reading. The games are one click away."
        description="Start with a favorite or browse the full original library."
        primaryTo="/games"
        primaryLabel="Browse all games"
        secondaryTo="/popular"
        secondaryLabel="See popular picks"
      />
    </>
  );
}
