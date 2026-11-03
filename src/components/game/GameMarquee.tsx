import { getCategory } from '../../data/categories';
import type { Game } from '../../types/game';

export function GameMarquee({ games }: { games: Game[] }) {
  return (
    <div
      aria-hidden="true"
      className="marquee overflow-hidden border-y border-line bg-raised py-4"
    >
      <div className="animate-marquee flex w-max">
        {[0, 1].map((group) => (
          <ul key={group} className="flex items-center gap-8 pr-8">
            {games.map((game) => (
              <li
                key={`${group}-${game.id}`}
                className="inline-flex items-center gap-3 whitespace-nowrap text-sm font-medium text-ink"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: game.accent }}
                />
                {game.title}
                <span className="text-muted">{getCategory(game.category).name}</span>
                <span className="text-muted/40">/</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
