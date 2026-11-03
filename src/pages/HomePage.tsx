import { ArrowRight, CheckCircle2, Play } from 'lucide-react';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AdRegion } from '../components/ads/AdRegion';
import { CategoryIcon } from '../components/category/CategoryIcon';
import { GameCard } from '../components/game/GameCard';
import { GameGrid } from '../components/game/GameGrid';
import { GameMarquee } from '../components/game/GameMarquee';
import { GameRail } from '../components/game/GameRail';
import { GameThumbnail } from '../components/game/GameThumbnail';
import { SearchBar } from '../components/search/SearchBar';
import { Seo } from '../components/seo/Seo';
import { ButtonLink } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { CtaBand } from '../components/ui/CtaBand';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SITE_DESCRIPTION, SITE_URL } from '../config/site';
import { getCategory } from '../data/categories';
import { sortGames } from '../lib/catalogue';
import { useCatalogue } from '../providers/CatalogueProvider';
import { usePreferences } from '../providers/PreferencesProvider';
import type { Game } from '../types/game';

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'NeonRift',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: 'en',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/games?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default function HomePage() {
  const { publishedGames, visibleCategories, categoryCounts, getGameById } = useCatalogue();
  const { favorites, recentlyPlayed } = usePreferences();

  const heroGame = useMemo(() => sortGames(publishedGames, 'featured')[0], [publishedGames]);
  const trendingGames = useMemo(
    () => sortGames(publishedGames, 'popular').slice(0, 4),
    [publishedGames],
  );
  const newGames = useMemo(() => sortGames(publishedGames, 'newest').slice(0, 6), [publishedGames]);
  const populatedCategories = useMemo(
    () => visibleCategories.filter((category) => (categoryCounts[category.id] ?? 0) > 0).slice(0, 6),
    [visibleCategories, categoryCounts],
  );

  const recentGames = useMemo(
    () =>
      recentlyPlayed
        .map((entry) => getGameById(entry.gameId))
        .filter((game): game is Game => Boolean(game?.published))
        .slice(0, 8),
    [recentlyPlayed, getGameById],
  );

  const recommendation = useMemo(() => {
    const playedIds = new Set(recentlyPlayed.map((entry) => entry.gameId));
    const seen = new Set<string>([...favorites, ...playedIds]);
    const pool = sortGames(
      publishedGames.filter((game) => !seen.has(game.id)),
      'featured',
    );

    const signals = new Set<string>();
    for (const id of [...favorites, ...playedIds]) {
      const game = getGameById(id);
      if (!game) continue;
      signals.add(game.category);
      for (const extra of game.secondaryCategories ?? []) signals.add(extra);
    }

    if (signals.size > 0) {
      const matched = pool.filter((game) =>
        [game.category, ...(game.secondaryCategories ?? [])].some((category) =>
          signals.has(category),
        ),
      );
      return {
        games: [...matched, ...pool.filter((game) => !matched.includes(game))].slice(0, 4),
        personalized: matched.length >= 2,
      };
    }

    return { games: pool.slice(0, 4), personalized: false };
  }, [publishedGames, favorites, recentlyPlayed, getGameById]);

  const newThisMonth = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    return publishedGames.filter((game) => new Date(game.createdAt).getTime() >= cutoff).length;
  }, [publishedGames]);

  if (!heroGame) {
    return (
      <>
        <Seo
          title="NeonRift — Free Browser Games, Zero Downloads"
          description={SITE_DESCRIPTION}
          path="/"
          jsonLd={websiteJsonLd}
        />
        <PageHeader
          eyebrow="Library"
          title="The library is warming up"
          description="No games are published right now. Check back shortly, or explore the categories we are building out."
        >
          <ButtonLink to="/categories">Explore categories</ButtonLink>
        </PageHeader>
      </>
    );
  }

  const heroCategory = getCategory(heroGame.category);
  const showRecommendations = recommendation.games.length > 0;

  return (
    <>
      <Seo
        title="NeonRift — Free Browser Games, Zero Downloads"
        description={SITE_DESCRIPTION}
        path="/"
        jsonLd={websiteJsonLd}
      />

      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px] rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-20 h-[520px] w-[520px] rounded-full bg-accent/10 blur-3xl"
        />

        <Container className="relative grid items-center gap-12 py-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16 lg:py-20">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 text-[11px] font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {publishedGames.length} original games · instant play
            </div>

            <h1 className="mt-6 text-[clamp(2.8rem,6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-ink">
              Your next favorite is <span className="text-gradient">one click away.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted sm:text-base">
              NeonRift is a growing library of free browser games built to start instantly. No
              downloads, no accounts, no waiting rooms — just pick a game and play.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/games" size="lg">
                Browse all games
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to={`/game/${heroGame.slug}`} variant="secondary" size="lg">
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Play {heroGame.title}
              </ButtonLink>
            </div>

            <div className="mt-8 max-w-xl">
              <SearchBar id="hero-search" size="hero" />
            </div>

            <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                Always free
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                No account needed
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                Built for mobile
              </li>
            </ul>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="surface-card rounded-[2rem] p-3">
              <Link
                to={`/game/${heroGame.slug}`}
                className="group block overflow-hidden rounded-[1.6rem] bg-night-950"
              >
                <div className="relative aspect-[16/11]">
                  <GameThumbnail game={heroGame} priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/20 to-transparent" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
                    <span className="rounded-full border border-white/15 bg-night-950/65 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                      Featured
                    </span>
                    <span className="rounded-full border border-white/15 bg-night-950/60 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
                      {heroCategory.name}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                      {heroGame.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-white/70">{heroGame.tagline}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-night-950 transition group-hover:bg-electric-300">
                        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                        Play now
                      </span>
                      <span className="text-xs text-white/50">Free · Instant</span>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="font-display text-2xl font-semibold text-ink">
                    {publishedGames.length}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted">
                    original games in the library
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="font-display text-2xl font-semibold text-ink">{newThisMonth}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted">new this month</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <GameMarquee games={publishedGames} />

      <div className="mt-6 space-y-16 sm:mt-10 sm:space-y-20">
        <AdRegion placement="home-top" />

        {recentGames.length > 0 ? (
          <section>
            <Container>
              <SectionHeader
                eyebrow="Pick up where you left off"
                title="Continue playing"
                actionLabel="View history"
                actionTo="/recently-played"
              />
              <div className="mt-6">
                <GameRail games={recentGames} />
              </div>
            </Container>
          </section>
        ) : null}

        <section>
          <Container>
            <SectionHeader
              eyebrow="Trending now"
              title="Games worth your next five minutes"
              description="An editor-curated shortlist from the NeonRift library, refreshed as new originals land."
              actionLabel="See all"
              actionTo="/popular"
            />
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {trendingGames[0] ? (
                <div className="md:col-span-2 xl:row-span-2">
                  <GameCard game={trendingGames[0]} size="feature" priority />
                </div>
              ) : null}
              {trendingGames.slice(1).map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
              <Link
                to="/popular"
                className="accent-tile group flex min-h-[120px] flex-col justify-between rounded-3xl p-5 transition hover:-translate-y-0.5 md:min-h-[160px]"
                style={{ '--chip': 'var(--nr-brand)' } as CSSProperties}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Curated
                </span>
                <span className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  See all popular picks
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </div>
          </Container>
        </section>

        {populatedCategories.length > 0 ? (
          <section>
            <Container>
              <SectionHeader
                eyebrow="Browse by vibe"
                title="Find your genre"
                description="Every game carries a primary category, with extra tags where the fit is real."
                actionLabel="All categories"
                actionTo="/categories"
              />
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {populatedCategories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/category/${category.id}`}
                    className="accent-tile group relative overflow-hidden rounded-2xl p-4 transition duration-200 hover:-translate-y-0.5"
                    style={{ '--chip': category.accent } as CSSProperties}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-surface">
                      <CategoryIcon icon={category.icon} className="h-5 w-5" />
                    </span>
                    <span className="mt-4 block text-sm font-semibold text-ink">{category.name}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-soft">
                      {categoryCounts[category.id]} game{categoryCounts[category.id] === 1 ? '' : 's'}
                    </span>
                    <ArrowRight
                      className="absolute right-3.5 top-3.5 h-4 w-4 text-ink/30 transition group-hover:text-ink/70"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        <section>
          <Container>
            <SectionHeader
              eyebrow="Just landed"
              title="New releases"
              description="The latest originals to join the library."
              actionLabel="All new games"
              actionTo="/new"
            />
            <div className="mt-6">
              <GameRail games={newGames} />
            </div>
          </Container>
        </section>

        {showRecommendations ? (
          <section>
            <Container>
              <SectionHeader
                eyebrow={recommendation.personalized ? 'Made for this browser' : 'Start here'}
                title={recommendation.personalized ? 'Picked for your taste' : 'Good places to start'}
                description={
                  recommendation.personalized
                    ? 'Based on the games you saved and played on this device. Everything stays local.'
                    : 'Four picks to get you into the rift. Save a favorite to tune future recommendations.'
                }
                actionLabel="All games"
                actionTo="/games"
              />
              <div className="mt-6">
                <GameGrid games={recommendation.games} />
              </div>
            </Container>
          </section>
        ) : null}

        <AdRegion placement="home-bottom" />

        <CtaBand
          title="No installs. No sign-ups. Just play."
          description="The whole library runs in your browser. Pick a game, beat your best, and come back when the next break hits."
          primaryTo="/games"
          primaryLabel="Browse all games"
          secondaryTo="/categories"
          secondaryLabel="Explore categories"
        />
      </div>
    </>
  );
}
