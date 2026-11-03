import { ChevronDown, SearchX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdRegion } from '../components/ads/AdRegion';
import { GameGrid } from '../components/game/GameGrid';
import { GameToolbar } from '../components/game/GameToolbar';
import { Seo } from '../components/seo/Seo';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { CtaBand } from '../components/ui/CtaBand';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { filterGames, sortGames } from '../lib/catalogue';
import { parseCategory, parseSort } from '../lib/urlState';
import { useCatalogue } from '../providers/CatalogueProvider';

const PAGE_SIZE = 6;

export default function GamesPage() {
  const { publishedGames, visibleCategories, categoryCounts } = useCatalogue();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const category = parseCategory(searchParams.get('category'));
  const sort = parseSort(searchParams.get('sort'));
  const [limit, setLimit] = useState(PAGE_SIZE);

  const results = useMemo(() => {
    const filtered = filterGames(publishedGames, {
      query,
      category: category === 'all' ? undefined : category,
    });
    return sortGames(filtered, sort);
  }, [publishedGames, query, category, sort]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [query, category, sort]);

  const shown = results.slice(0, limit);
  const hasActiveFilters = Boolean(query) || category !== 'all';

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  return (
    <>
      <Seo
        title="All Games"
        description={`Browse all ${publishedGames.length} free browser games on the NeonRift library. Filter by genre, search by name and play instantly.`}
        path="/games"
      />
      <PageHeader
        eyebrow="The library"
        title="All games, ready when you are"
        description="Every game here runs in the browser. Search the shelf, filter by genre, and start playing without an account."
      />

      <Container className="py-8 sm:py-10">
        <GameToolbar
          query={query}
          onQueryChange={(value) => updateParam('q', value || null)}
          sort={sort}
          onSortChange={(value) => updateParam('sort', value === 'featured' ? null : value)}
          resultCount={results.length}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
          categories={visibleCategories}
          categoryCounts={categoryCounts}
          activeCategory={category}
          onCategoryChange={(value) =>
            updateParam('category', value === 'all' ? null : value)
          }
        />

        <AdRegion placement="listing-top" className="mt-8" />

        <div className="mt-8">
          {shown.length > 0 ? (
            <GameGrid games={shown} priorityCount={3} />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No games match those filters"
              description={
                publishedGames.length === 0
                  ? 'The library is empty right now. New original games are added regularly — check back soon.'
                  : 'Try a shorter search, a different genre, or clear the filters to see the whole library.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>

        {results.length > limit ? (
          <div className="mt-10 flex justify-center">
            <Button variant="outline" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
              Load more games
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </Container>

      <CtaBand
        title="Can't decide? Let the grid decide."
        description="Save a few favorites and NeonRift will tune the homepage picks to the genres you actually play."
        primaryTo="/categories"
        primaryLabel="Browse by category"
        secondaryTo="/popular"
        secondaryLabel="See popular picks"
      />
    </>
  );
}
