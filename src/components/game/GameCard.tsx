import { ArrowUpRight, Heart, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCategory } from '../../data/categories';
import { track } from '../../lib/analytics';
import { cn } from '../../lib/cn';
import { usePreferences } from '../../providers/PreferencesProvider';
import { useToast } from '../../providers/ToastProvider';
import type { Game } from '../../types/game';
import { Badge } from '../ui/Badge';
import { GameThumbnail } from './GameThumbnail';

export function GameCard({
  game,
  priority = false,
  className,
}: {
  game: Game;
  priority?: boolean;
  className?: string;
}) {
  const { isFavorite, toggleFavorite } = usePreferences();
  const { showToast } = useToast();
  const category = getCategory(game.category);
  const favorite = isFavorite(game.id);

  function handleFavorite() {
    const added = toggleFavorite(game.id);
    showToast(added ? 'Added to favorites' : 'Removed from favorites');
    track('favorite', { game: game.slug, action: added ? 'add' : 'remove' });
  }

  return (
    <article className={cn('group relative min-w-0', className)}>
      <Link to={`/game/${game.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-white/10 bg-night-800 shadow-lg shadow-black/30 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-electric-400/30 group-hover:shadow-[0_24px_60px_-24px_rgba(76,141,255,0.5)]">
          <GameThumbnail game={game} priority={priority} />
          <div className="absolute inset-0 bg-gradient-to-t from-night-950/85 via-night-950/5 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
            <Badge className="bg-night-950/65 backdrop-blur-md">{category.name}</Badge>
            {game.featured ? (
              <Badge tone="electric" className="bg-night-950/65 backdrop-blur-md">
                Featured
              </Badge>
            ) : null}
          </div>
          <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-night-950 shadow-xl shadow-black/40">
              <Play className="h-5 w-5 translate-x-[1px] fill-current" aria-hidden="true" />
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3 px-0.5">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[15px] font-semibold text-ink">{game.title}</h3>
            <p className="mt-0.5 truncate text-[13px] text-muted">{game.tagline}</p>
          </div>
          <ArrowUpRight
            className="mt-1 h-4 w-4 shrink-0 text-muted/60 transition group-hover:text-electric-300"
            aria-hidden="true"
          />
        </div>
      </Link>
      <button
        type="button"
        onClick={handleFavorite}
        aria-label={favorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
        aria-pressed={favorite}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-night-950/55 text-ink/80 backdrop-blur-md transition hover:bg-night-950/85 hover:text-white"
      >
        <Heart className={cn('h-4 w-4 transition', favorite && 'fill-coral text-coral')} aria-hidden="true" />
      </button>
    </article>
  );
}
