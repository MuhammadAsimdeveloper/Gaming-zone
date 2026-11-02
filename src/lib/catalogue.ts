import { categories } from '../data/categories';
import type { CategoryId, Game } from '../types/game';

export type GameSort = 'featured' | 'popular' | 'newest' | 'title';

const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function searchCorpus(game: Game): string {
  const categoryLabels = [game.category, ...(game.secondaryCategories ?? [])]
    .map((id) => categoryNames.get(id) ?? id)
    .join(' ');
  return normalize(
    [game.title, game.tagline, game.description, categoryLabels, game.internalKey ?? ''].join(' '),
  );
}

export function matchesQuery(game: Game, query: string): boolean {
  const tokens = normalize(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const corpus = searchCorpus(game);
  return tokens.every((token) => corpus.includes(token));
}

export function isInCategory(game: Game, category: CategoryId): boolean {
  return game.category === category || (game.secondaryCategories ?? []).includes(category);
}

export interface FilterOptions {
  query?: string;
  category?: CategoryId;
}

export function filterGames(games: Game[], options: FilterOptions = {}): Game[] {
  const query = options.query?.trim() ?? '';
  return games.filter((game) => {
    if (options.category && !isInCategory(game, options.category)) return false;
    if (query && !matchesQuery(game, query)) return false;
    return true;
  });
}

export function sortGames(games: Game[], sort: GameSort): Game[] {
  const copy = [...games];
  switch (sort) {
    case 'popular':
      return copy.sort((a, b) => a.popularityRank - b.popularityRank);
    case 'newest':
      return copy.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title, 'en'));
    case 'featured':
    default:
      return copy.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.popularityRank - b.popularityRank;
      });
  }
}

export function pageSlice<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice(0, Math.max(0, page) * pageSize);
}
