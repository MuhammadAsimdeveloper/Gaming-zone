import { ArrowUpRight, Heart, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCategory } from '../../data/categories';
import { track } from '../../lib/analytics';
import { cn } from '../../lib/cn';
import { usePreferences } from '../../providers/PreferencesProvider';
import { useToast } from '../../providers/ToastProvider';
import type { Game } from '../../types/game';
import { GameThumbnail } from './GameThumbnail';

export function GameCard({
  game,
  priority = false,
  size = 'default',
  className,
}: {
  game: Game;
  priority?: boolean;
  size?: 'default' | 'feature';
  className?: string;
}) {
  const { isFavorite, toggleFavorite } = usePreferences();
  const { showToast } = useToast();
  const category = getCategory(game.category);
  const favorite = isFavorite(game.id);
  const feature = size === 'feature';

  function handleFavorite() {
    const added = toggleFavorite(game.id);
    showToast(added ? 'Added to favorites' : 'Removed from favorites');
    track('favorite', { game: game.slug, action: added ? 'add' : 'remove' });
  }

  return (
    <article className={cn('group relative min-w-0', feature && 'h-full', className)}>
      <Link to={`/game/${game.slug}`} className={cn('block', feature && 'flex h-full flex-col')}>
        <div
          className={cn(
            'game-card relative overflow-hidden rounded-3xl border border-line bg-sunken',
            feature ? 'min-h-[320px] flex-1 sm:min-h-[380px]' : 'aspect-[16/10]',
          )}
        >
          <GameThumbnail game={game} priority={priority} />
          <div className="absolute inset-0 bg-gradient-to-t from-night-950/85 via-night-950/5 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
            <span className="rounded-full border border-white/15 bg-night-950/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">
              {category.name}
            </span>
            {game.featured ? (
              <span className="rounded-full border border-white/15 bg-night-950/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">
                Featured
              </span>
            ) : null}
          </div>
          <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-night-950 shadow-xl shadow-black/40">
              <Play className="h-5 w-5 translate-x-[1px] fill-current" aria-hidden="true" />
            </span>
          </div>
        </div>
        <div
          className={cn(
            'flex items-start justify-between gap-3 px-0.5',
            feature ? 'mt-4' : 'mt-3',
          )}
        >
          <div className="min-w-0">
            <h3
              className={cn(
                'truncate font-display font-semibold text-ink',
                feature ? 'text-xl sm:text-2xl' : 'text-[15px]',
              )}
            >
              {game.title}
            </h3>
            <p
              className={cn(
                'mt-0.5 truncate text-muted',
                feature ? 'text-sm' : 'text-[13px]',
              )}
            >
              {game.tagline}
            </p>
          </div>
          <ArrowUpRight
            className="mt-1 h-4 w-4 shrink-0 text-muted/60 transition group-hover:text-brand"
            aria-hidden="true"
          />
        </div>
      </Link>
      <button
        type="button"
        onClick={handleFavorite}
        aria-label={favorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
        aria-pressed={favorite}
        className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-night-950/60 text-white backdrop-blur-md transition hover:bg-night-950/85 focus-visible:outline-white"
      >
        <Heart className={cn('h-4 w-4 transition', favorite && 'fill-coral text-coral')} aria-hidden="true" />
      </button>
    </article>
  );
}
