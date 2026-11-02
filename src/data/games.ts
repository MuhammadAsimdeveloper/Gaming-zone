import rawGames from './games.json';
import type { CategoryId, Game } from '../types/game';
import { categories } from './categories';

export const baseGames = rawGames as unknown as Game[];

export function countByCategory(games: Game[]): Record<CategoryId, number> {
  const counts = Object.fromEntries(categories.map((category) => [category.id, 0])) as Record<
    CategoryId,
    number
  >;

  for (const game of games) {
    counts[game.category] += 1;
    for (const secondary of game.secondaryCategories ?? []) {
      counts[secondary] += 1;
    }
  }

  return counts;
}
