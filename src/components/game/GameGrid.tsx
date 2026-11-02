import { cn } from '../../lib/cn';
import type { Game } from '../../types/game';
import { GameCard } from './GameCard';

export function GameGrid({
  games,
  className,
  priorityCount = 0,
}: {
  games: Game[];
  className?: string;
  priorityCount?: number;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {games.map((game, index) => (
        <div
          key={game.id}
          className="animate-fade-up"
          style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
        >
          <GameCard game={game} priority={index < priorityCount} />
        </div>
      ))}
    </div>
  );
}
