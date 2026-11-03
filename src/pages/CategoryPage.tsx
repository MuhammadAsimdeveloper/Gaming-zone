import { ChevronDown, SearchX, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AdRegion } from '../components/ads/AdRegion';
import { CategoryIcon } from '../components/category/CategoryIcon';
import { GameGrid } from '../components/game/GameGrid';
import { GameToolbar } from '../components/game/GameToolbar';
import { Seo } from '../components/seo/Seo';
import { Button, ButtonLink } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { filterGames, sortGames } from '../lib/catalogue';
import { parseSort } from '../lib/urlState';
import { useCatalogue } from '../providers/CatalogueProvider';
import NotFoundPage from './NotFoundPage';

const PAGE_SIZE = 6;

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const { visibleCategories, publishedGames } = useCatalogue();
  const category = visibleCategories.find((entry) => entry.id === categoryId);

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const sort = parseSort(searchParams.get('sort'));
  const [limit, setLimit] = useState(PAGE_SIZE);

  const categoryGames = useMemo(
    () => (category ? filterGames(publishedGames, { category: category.id }) : []),
    [publishedGames, category],
  );
  const results = useMemo(
    () => sortGames(filterGames(categoryGames, { query }), sort),
    [categoryGames, query, sort],
  );

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [query, sort, categoryId]);

  if (!category) return <NotFoundPage />;

  const shown = results.slice(0, limit);

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <Seo
        title={`${category.name} Games`}
        description={`${category.description} Play every ${category.name.toLowerCase()} game on NeonRift instantly in your browser.`}
        path={`/category/${category.id}`}
      />
      <PageHeader
        eyebrow="Category"
        title={`${category.name} games`}
        description={category.description}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 text-xs font-medium text-ink"
          >
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-ink text-surface">
              <CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
            </span>
            {categoryGames.length} game{categoryGames.length === 1 ? '' : 's'} published
          </span>
          <Link
            to="/categories"
            className="inline-flex min-h-6 items-center rounded-full px-2 py-1 text-xs font-medium text-muted transition hover:text-ink"
          >
            All categories
          </Link>
        </div>
      </PageHeader>

      <Container className="py-8 sm:py-10">
        <GameToolbar
          query={query}
          onQueryChange={(value) => updateParam('q', value || null)}
          sort={sort}
          onSortChange={(value) => updateParam('sort', value === 'featured' ? null : value)}
          resultCount={results.length}
          hasActiveFilters={Boolean(query)}
          onClear={() => updateParam('q', null)}
          placeholder={`Search ${category.name.toLowerCase()} games...`}
        />

        <AdRegion placement="category-top" className="mt-8" />

        <div className="mt-8">
          {shown.length > 0 ? (
            <GameGrid games={shown} priorityCount={3} />
          ) : categoryGames.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={`No ${category.name.toLowerCase()} games yet`}
              description="We only publish games we have actually built and tested. This category is on the shelf, but it is empty for now."
              action={<ButtonLink to="/games">Browse all games</ButtonLink>}
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title={`No ${category.name.toLowerCase()} games match`}
              description="Try a different search term, or clear it to see every game in this category."
              action={
                <Button variant="secondary" onClick={() => updateParam('q', null)}>
                  Clear search
                </Button>
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

        <div className="mt-14 border-t border-line pt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
            Keep exploring
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {visibleCategories
              .filter((entry) => entry.id !== category.id)
              .map((entry) => (
                <Link
                  key={entry.id}
                  to={`/category/${entry.id}`}
                  className="group inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-raised px-3.5 py-2 text-sm text-muted transition hover:border-ink/25 hover:text-ink"
                >
                  <CategoryIcon icon={entry.icon} className="h-4 w-4" />
                  {entry.name}
                </Link>
              ))}
          </div>
        </div>
      </Container>
    </>
  );
}
