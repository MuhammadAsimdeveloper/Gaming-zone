import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CategoryIcon } from '../components/category/CategoryIcon';
import { Seo } from '../components/seo/Seo';
import { Badge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { CtaBand } from '../components/ui/CtaBand';
import { PageHeader } from '../components/ui/PageHeader';
import { useCatalogue } from '../providers/CatalogueProvider';

export default function CategoriesPage() {
  const { visibleCategories, categoryCounts, publishedGames } = useCatalogue();

  return (
    <>
      <Seo
        title="Game Categories"
        description="Browse free browser games by genre: arcade, puzzle, strategy, action, casual, educational and more. Every count shown is real."
        path="/categories"
      />
      <PageHeader
        eyebrow="Browse"
        title="Game categories"
        description="Every game has a primary genre, plus extra tags where they genuinely fit. Counts are pulled straight from the published library."
      >
        <ButtonLink to="/games" variant="secondary" size="sm">
          Browse all {publishedGames.length} games
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </ButtonLink>
      </PageHeader>

      <Container className="py-8 sm:py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCategories.map((category) => {
            const count = categoryCounts[category.id] ?? 0;
            return (
              <Link
                key={category.id}
                to={`/category/${category.id}`}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.045]"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                  style={{ backgroundColor: category.glow }}
                />
                <div className="relative flex items-start justify-between">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10"
                    style={{ backgroundColor: `${category.accent}1f`, color: category.accent }}
                  >
                    <CategoryIcon icon={category.icon} className="h-5 w-5" />
                  </span>
                  <Badge tone={count > 0 ? 'electric' : 'neutral'}>
                    {count} game{count === 1 ? '' : 's'}
                  </Badge>
                </div>
                <h2 className="relative mt-5 font-display text-lg font-semibold text-ink">
                  {category.name}
                </h2>
                <p className="relative mt-2 text-sm leading-6 text-muted">{category.description}</p>
                <span className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition group-hover:text-electric-300">
                  {count > 0 ? 'View category' : 'Nothing published yet'}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-xs leading-5 text-muted/60">
          The multiplayer category stays hidden until a genuinely multiplayer game is published.
        </p>
      </Container>

      <CtaBand
        title="Not sure which genre fits?"
        description="Hit the full library and scan the shelf. Every card names its category, so you can follow your mood."
        primaryTo="/games"
        primaryLabel="Browse all games"
        secondaryTo="/popular"
        secondaryLabel="See popular picks"
      />
    </>
  );
}
