import { ChevronDown, Search, X } from 'lucide-react';
import type { Category } from '../../data/categories';
import type { GameSort } from '../../lib/catalogue';
import { cn } from '../../lib/cn';
import type { CategoryId } from '../../types/game';

const sortLabels: Record<GameSort, string> = {
  featured: 'Featured first',
  popular: 'Most popular',
  newest: 'Newest first',
  title: 'A – Z',
};

export function GameToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  resultCount,
  hasActiveFilters,
  onClear,
  categories,
  categoryCounts,
  activeCategory,
  onCategoryChange,
  placeholder = 'Search the library...',
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: GameSort;
  onSortChange: (value: GameSort) => void;
  resultCount: number;
  hasActiveFilters: boolean;
  onClear: () => void;
  categories?: Category[];
  categoryCounts?: Record<CategoryId, number>;
  activeCategory?: CategoryId | 'all';
  onCategoryChange?: (value: CategoryId | 'all') => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="game-search"
            name="game-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            aria-label="Search games"
            className="field h-11 w-full rounded-full pl-11 pr-10 text-sm"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="relative shrink-0">
          <label htmlFor="game-sort" className="sr-only">
            Sort games
          </label>
          <select
            id="game-sort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as GameSort)}
            className="h-11 w-full appearance-none rounded-full border border-line-strong bg-raised pl-4 pr-10 text-sm font-medium text-ink transition hover:border-ink/40 sm:w-auto"
          >
            {(Object.keys(sortLabels) as GameSort[]).map((value) => (
              <option key={value} value={value}>
                {sortLabels[value]}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {categories && onCategoryChange ? (
          <div
            className="no-scrollbar -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 py-0.5"
            role="group"
            aria-label="Filter by category"
          >
            <button
              type="button"
              onClick={() => onCategoryChange('all')}
              aria-pressed={activeCategory === 'all'}
              className={cn(
                'chip shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium',
                activeCategory === 'all' ? 'chip-active' : '',
              )}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onCategoryChange(category.id)}
                aria-pressed={activeCategory === category.id}
                className={cn(
                  'chip shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium',
                  activeCategory === category.id ? 'chip-active' : '',
                )}
              >
                {category.name}
                {categoryCounts ? (
                  <span className="ml-1.5 text-[10px]">{categoryCounts[category.id]}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3 text-xs text-muted">
          <span>
            {resultCount} game{resultCount === 1 ? '' : 's'}
          </span>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-full px-2 py-1 font-medium text-brand transition hover:bg-brand/10"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
