import {
  ArrowLeft,
  Check,
  Expand,
  Gamepad2,
  Heart,
  Info,
  Keyboard,
  Loader2,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SectionHeader } from '../components/ui/SectionHeader';
import { AdSlot } from '../components/ads/AdSlot';
import { GameErrorBoundary } from '../components/game/GameErrorBoundary';
import { GameGrid } from '../components/game/GameGrid';
import { GameThumbnail } from '../components/game/GameThumbnail';
import { Seo } from '../components/seo/Seo';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { SITE_URL, EXTERNAL_GAME_ORIGINS } from '../config/site';
import { getCategory } from '../data/categories';
import { gameRegistry } from '../games/registry';
import { track } from '../lib/analytics';
import { sortGames } from '../lib/catalogue';
import { validateExternalGameUrl } from '../lib/embed';
import { formatDate } from '../lib/format';
import { cn } from '../lib/cn';
import { useCatalogue } from '../providers/CatalogueProvider';
import { usePreferences } from '../providers/PreferencesProvider';
import { useToast } from '../providers/ToastProvider';
import type { PlayEvent } from '../types/game';
import NotFoundPage from './NotFoundPage';

function PlayerSkeleton({ label }: { label: string }) {
  return (
    <div className="grid min-h-[440px] place-items-center rounded-3xl border border-line bg-night-900">
      <div className="text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-electric-400" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-ink">Loading {label}</p>
        <p className="mt-1 text-xs text-muted">Preparing the game engine…</p>
      </div>
    </div>
  );
}

function iconButtonClasses(active = false): string {
  return cn(
    'grid h-10 w-10 place-items-center rounded-full border transition',
    active
      ? 'border-coral/40 bg-coral/10 text-coral'
      : 'border-line bg-raised text-muted hover:border-ink/25 hover:text-ink',
  );
}

export default function GamePage() {
  const { slug } = useParams();
  const { getGameBySlug, publishedGames } = useCatalogue();
  const { isFavorite, toggleFavorite, addRecent } = usePreferences();
  const { showToast } = useToast();
  const game = slug ? getGameBySlug(slug) : undefined;
  const returnsToSetup =
    game?.type === 'internal' &&
    ['neon-apex', 'rift-striker', 'neon-city-drive'].includes(game.internalKey ?? '');

  const [restartKey, setRestartKey] = useState(0);
  const [launched, setLaunched] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const startTracked = useRef(false);

  useEffect(() => {
    setRestartKey(0);
    setLaunched(false);
    setFrameLoaded(false);
    startTracked.current = false;
  }, [slug]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const route = useMemo(() => {
    if (!game || game.type !== 'external' || !game.externalUrl) return null;
    const origins = [...EXTERNAL_GAME_ORIGINS, ...(game.allowedOrigins ?? [])];
    return validateExternalGameUrl(game.externalUrl, origins, { allowLocalhost: import.meta.env.DEV });
  }, [game]);

  const related = useMemo(() => {
    if (!game) return [];
    const pool = publishedGames.filter((entry) => entry.id !== game.id);
    const shared = pool.filter(
      (entry) =>
        entry.category === game.category ||
        entry.secondaryCategories?.includes(game.category) ||
        game.secondaryCategories?.includes(entry.category),
    );
    const rest = sortGames(pool, 'popular').filter((entry) => !shared.includes(entry));
    return [...shared, ...rest].slice(0, 4);
  }, [game, publishedGames]);

  const category = game ? getCategory(game.category) : null;

  const handleStart = useCallback(() => {
    if (!game) return;
    addRecent(game.id);
    if (!startTracked.current) {
      startTracked.current = true;
      track('game_launch', { game: game.slug, type: game.type, category: game.category });
    }
  }, [game, addRecent]);

  const handleComplete = useCallback(
    (event: PlayEvent) => {
      if (!game) return;
      track('game_complete', {
        game: game.slug,
        score: event.score ?? 0,
        outcome: event.outcome ?? 'complete',
      });
    },
    [game],
  );

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await stageRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      showToast('Fullscreen is not available in this browser');
    }
  }

  function handleShare() {
    if (!game) return;
    const url = `${window.location.origin}/game/${game.slug}`;
    const shareData = { title: `${game.title} — NeonRift`, text: game.tagline, url };
    if (navigator.share) {
      void navigator
        .share(shareData)
        .then(() => track('share', { game: game.slug, method: 'web-share' }))
        .catch(() => undefined);
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard?.writeText) {
        showToast('Copying requires a secure browser connection');
        return;
      }
      void clipboard
        .writeText(url)
        .then(() => {
          showToast('Game link copied');
          track('share', { game: game.slug, method: 'clipboard' });
        })
        .catch(() => showToast('Could not copy the link'));
    } catch {
      showToast('Could not copy the link');
    }
  }

  function handleFavorite() {
    if (!game) return;
    const added = toggleFavorite(game.id);
    showToast(added ? 'Added to favorites' : 'Removed from favorites');
    track('favorite', { game: game.slug, action: added ? 'add' : 'remove' });
  }

  function restart() {
    if (!game) return;
    setRestartKey((key) => key + 1);
    setLaunched((value) => (game.type === 'external' ? false : value));
    setFrameLoaded(false);
    track('game_restart', { game: game.slug });
    showToast(returnsToSetup ? 'Returned to game setup' : 'Game restarted');
  }

  function launchExternal() {
    setLaunched(true);
    handleStart();
  }

  if (!game) {
    return <NotFoundPage />;
  }

  const InternalGame = game.internalKey ? gameRegistry[game.internalKey] : null;
  const favorite = isFavorite(game.id);
  const gameJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.title,
    description: game.description,
    url: `${SITE_URL}/game/${game.slug}`,
    image: `${SITE_URL}${game.thumbnail}`,
    genre: category?.name,
    applicationCategory: 'Game',
    operatingSystem: 'Any modern browser',
    gamePlatform: 'Web browser',
    playMode: game.category === 'multiplayer' ? 'MultiPlayer' : 'SinglePlayer',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <>
      <Seo
        title={`${game.title} — Play Free Online`}
        description={game.description}
        path={`/game/${game.slug}`}
        image={game.thumbnail}
        jsonLd={gameJsonLd}
      />

      <Container className="py-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Link to="/" className="transition hover:text-ink">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link to="/games" className="transition hover:text-ink">
            Games
          </Link>
          <span aria-hidden="true">/</span>
          <Link to={`/category/${game.category}`} className="transition hover:text-ink">
            {category?.name ?? game.category}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink/80">{game.title}</span>
        </nav>

        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="electric">{category?.name ?? game.category}</Badge>
                  {game.type === 'internal' ? (
                    <Badge tone="mint">
                      <Gamepad2 className="h-3 w-3" aria-hidden="true" />
                      Playable now
                    </Badge>
                  ) : (
                    <Badge>External · sandboxed</Badge>
                  )}
                  {game.featured ? <Badge tone="plasma">Featured</Badge> : null}
                </div>
                <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
                  {game.title}
                </h1>
                <p className="mt-1 text-sm text-muted">{game.tagline}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFavorite}
                  aria-pressed={favorite}
                  aria-label={favorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
                  className={iconButtonClasses(favorite)}
                >
                  <Heart className={cn('h-4 w-4', favorite && 'fill-current')} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label={`Share ${game.title}`}
                  className={iconButtonClasses()}
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={restart}
                  aria-label={returnsToSetup ? "Return game to setup" : "Restart game"}
                  className={iconButtonClasses()}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  className={iconButtonClasses()}
                >
                  <Expand className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              ref={stageRef}
              className={cn(
                'relative overflow-hidden rounded-3xl border border-line bg-night-950 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]',
                isFullscreen && 'rounded-none border-0',
              )}
            >
              {game.type === 'internal' && InternalGame ? (
                <Suspense fallback={<PlayerSkeleton label={game.title} />}>
                  <GameErrorBoundary onReset={restart}>
                    <InternalGame
                      key={restartKey}
                      onStart={handleStart}
                      onComplete={handleComplete}
                    />
                  </GameErrorBoundary>
                </Suspense>
              ) : game.type === 'external' ? (
                route && route.ok ? (
                  launched ? (
                    <div className="relative min-h-[480px] bg-night-950">
                      {!frameLoaded ? (
                        <div className="absolute inset-0 grid place-items-center">
                          <div className="text-center">
                            <Loader2 className="mx-auto h-7 w-7 animate-spin text-electric-400" aria-hidden="true" />
                            <p className="mt-3 text-sm text-muted">Connecting to the game host…</p>
                          </div>
                        </div>
                      ) : null}
                      <iframe
                        key={`${restartKey}-${game.externalUrl}`}
                        src={route.url}
                        title={`${game.title} — external game`}
                        className="relative h-[min(70vh,640px)] w-full border-0"
                        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-orientation-lock allow-forms"
                        allow="fullscreen; gamepad; accelerometer; gyroscope"
                        allowFullScreen
                        referrerPolicy="no-referrer"
                        onLoad={() => setFrameLoaded(true)}
                      />
                    </div>
                  ) : (
                    <div className="grid min-h-[480px] place-items-center p-6">
                      <div className="max-w-md text-center">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-electric-400/25 bg-electric-500/10 text-electric-300">
                          <Gamepad2 className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <h2 className="mt-4 font-display text-xl font-semibold text-ink">
                          Launched from {new URL(route.url).hostname}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          This game runs on an external, approved host inside a sandboxed frame. It
                          cannot read this page, your favorites or your stored data.
                        </p>
                        <Button className="mt-5" onClick={launchExternal}>
                          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                          Launch game
                        </Button>
                        <p className="mt-3 text-[11px] text-muted">
                          External host: {new URL(route.url).origin}
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="grid min-h-[420px] place-items-center p-6">
                    <div className="max-w-md text-center">
                      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
                        <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h2 className="mt-4 font-display text-lg font-semibold text-ink">
                        External game unavailable
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {route?.ok === false ? route.reason : 'The game source is not configured.'}
                      </p>
                      <p className="mt-3 text-xs text-muted">
                        For safety, NeonRift never executes an external URL that is not on the
                        approved origin list.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="grid min-h-[420px] place-items-center p-6 text-center">
                  <div>
                    <TriangleAlert className="mx-auto h-6 w-6 text-amber-300" aria-hidden="true" />
                    <p className="mt-3 text-sm text-muted">This game has no playable runtime yet.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
              <p className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                No account · progress stays in this browser
              </p>
              <p>Published {formatDate(game.createdAt)}</p>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <section className="rounded-3xl border border-line bg-raised/60 p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                  <Info className="h-4 w-4 text-electric-300" aria-hidden="true" />
                  How to play
                </h2>
                <ol className="mt-3 space-y-2.5 text-sm leading-6 text-muted">
                  {game.instructions.map((instruction, index) => (
                    <li key={instruction} className="flex gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sunken text-[10px] font-semibold text-ink">
                        {index + 1}
                      </span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="rounded-3xl border border-line bg-raised/60 p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                  <Keyboard className="h-4 w-4 text-plasma-300" aria-hidden="true" />
                  Controls
                </h2>
                <dl className="mt-3 space-y-2.5 text-sm">
                  {game.controls.map((control) => (
                    <div key={control.label} className="flex items-start justify-between gap-3">
                      <dt className="text-muted">{control.label}</dt>
                      <dd className="rounded-lg border border-line bg-sunken px-2 py-0.5 text-right text-xs font-medium text-ink">
                        {control.keys}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>

            <section className="mt-6 rounded-3xl border border-line bg-raised/60 p-5">
              <h2 className="font-display text-base font-semibold text-ink">About this game</h2>
              <p className="mt-2 text-sm leading-7 text-muted">{game.description}</p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                <Check className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                {game.type === 'internal'
                  ? 'Original code and art built for NeonRift. No third-party assets.'
                  : 'Hosted by an approved external provider under its own license.'}
              </p>
            </section>

            <div className="mt-8">
              <AdSlot placement="game-below" />
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-line bg-raised/60 p-4">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line">
                <GameThumbnail game={game} priority />
              </div>
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Category</dt>
                  <dd className="text-right font-medium text-ink">
                    <Link to={`/category/${game.category}`} className="hover:text-brand">
                      {category?.name ?? game.category}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Runtime</dt>
                  <dd className="text-right font-medium text-ink">
                    {game.type === 'internal' ? 'In-house game engine' : 'Sandboxed external'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Price</dt>
                  <dd className="text-right font-medium text-mint">Free</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Account</dt>
                  <dd className="text-right font-medium text-ink">Not required</dd>
                </div>
              </dl>
            </div>

            <AdSlot placement="game-sidebar" />

            {related.length > 0 ? (
              <section>
                <SectionHeader eyebrow="Keep playing" title="Related games" />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {related.slice(0, 3).map((entry) => (
                    <Link
                      key={entry.id}
                      to={`/game/${entry.slug}`}
                      className="group flex gap-3 rounded-2xl border border-line bg-raised/60 p-2.5 transition hover:border-ink/25 hover:bg-sunken"
                    >
                      <div className="relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-xl border border-line">
                        <GameThumbnail game={entry} />
                      </div>
                      <div className="min-w-0 self-center">
                        <p className="truncate text-sm font-semibold text-ink">{entry.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-muted">
                          {entry.tagline}
                        </p>
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand">
                          <Play className="h-3 w-3 fill-current" aria-hidden="true" /> Play
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <Link
              to="/games"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to all games
            </Link>
          </aside>
        </div>

        {related.length > 0 ? (
          <section className="mt-12">
            <SectionHeader
              eyebrow="More like this"
              title="You might also like"
              actionLabel="All games"
              actionTo="/games"
            />
            <div className="mt-5">
              <GameGrid games={related} />
            </div>
          </section>
        ) : null}
      </Container>
    </>
  );
}
