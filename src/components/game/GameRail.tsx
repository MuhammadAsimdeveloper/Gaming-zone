import type { Game } from '../../types/game';
import { GameCard } from './GameCard';

export function GameRail({ games }: { games: Game[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {games.map((game) => (
        <div key={game.id} className="w-[272px] shrink-0 snap-start sm:w-[310px]">
          <GameCard game={game} />
        </div>
      ))}
    </div>
  );
}
