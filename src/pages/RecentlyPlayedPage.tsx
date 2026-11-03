import { History, Play, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GameThumbnail } from '../components/game/GameThumbnail';
import { Seo } from '../components/seo/Seo';
import { Button, ButtonLink } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { getCategory } from '../data/categories';
import { formatRelativeTime } from '../lib/format';
import { useCatalogue } from '../providers/CatalogueProvider';
import { usePreferences } from '../providers/PreferencesProvider';
import { useToast } from '../providers/ToastProvider';

export default function RecentlyPlayedPage() {
  const { recentlyPlayed, clearRecentlyPlayed } = usePreferences();
  const { getGameById } = useCatalogue();
  const { showToast } = useToast();

  const entries = useMemo(
    () =>
      recentlyPlayed.flatMap((entry) => {
        const game = getGameById(entry.gameId);
        return game?.published ? [{ game, playedAt: entry.playedAt }] : [];
      }),
    [recentlyPlayed, getGameById],
  );

  function handleClear() {
    clearRecentlyPlayed();
    showToast('Play history cleared');
  }

  return (
    <>
      <Seo
        title="Recently Played"
        description="Jump back into the browser games you played on this device."
        path="/recently-played"
        noIndex
      />
      <PageHeader
        eyebrow="Your library"
        title="Recently played"
        description="A local, private history of the games you have launched on this device."
      >
        {entries.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Clear history
          </Button>
        ) : null}
      </PageHeader>

      <Container className="py-8 sm:py-10">
        {entries.length > 0 ? (
          <>
            <ol className="overflow-hidden rounded-3xl border border-line bg-raised/60">
              {entries.map(({ game, playedAt }) => (
                <li key={game.id} className="border-b border-line last:border-b-0">
                  <Link
                    to={`/game/${game.slug}`}
                    className="group flex items-center gap-4 p-3 transition hover:bg-sunken sm:p-4"
                  >
                    <span className="relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-xl border border-line sm:w-32">
                      <GameThumbnail game={game} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold text-ink sm:text-base">
                        {game.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {getCategory(game.category).name} · {game.tagline}
                      </span>
                      <span className="mt-1.5 block text-[11px] text-muted">
                        Played {formatRelativeTime(playedAt)}
                      </span>
                    </span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-raised text-ink transition group-hover:border-brand/40 group-hover:bg-brand/10 group-hover:text-brand">
                      <Play className="h-4 w-4 translate-x-[1px] fill-current" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-xs leading-5 text-muted">
              History is stored locally in this browser and capped at the last 24 games. Clearing
              site data removes it.
            </p>
          </>
        ) : (
          <EmptyState
            icon={History}
            title="No games played yet"
            description="Launch a game and it will appear here so you can jump straight back in. This history never leaves your device."
            action={<ButtonLink to="/games">Find a game</ButtonLink>}
          />
        )}
      </Container>
    </>
  );
}
