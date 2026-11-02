import { useMemo } from 'react';
import { AdRegion } from '../components/ads/AdRegion';
import { GameGrid } from '../components/game/GameGrid';
import { Seo } from '../components/seo/Seo';
import { Container } from '../components/ui/Container';
import { CtaBand } from '../components/ui/CtaBand';
import { PageHeader } from '../components/ui/PageHeader';
import { sortGames } from '../lib/catalogue';
import { useCatalogue } from '../providers/CatalogueProvider';

export default function NewPage() {
  const { publishedGames } = useCatalogue();
  const games = useMemo(() => sortGames(publishedGames, 'newest'), [publishedGames]);

  return (
    <>
      <Seo
        title="New Games"
        description="The newest original browser games on NeonRift. Fresh arcade, puzzle, strategy and casual releases, playable instantly."
        path="/new"
      />
      <PageHeader
        eyebrow="Fresh from the rift"
        title="New releases"
        description="Every game is an original build. Here is the newest work in the library, sorted by publication date."
      />

      <Container className="py-8 sm:py-10">
        <AdRegion placement="listing-top" className="mb-8" />
        <GameGrid games={games} priorityCount={3} />
      </Container>

      <CtaBand
        title="Older does not mean worse."
        description="The full library is always available. Search by name or browse by genre to find a classic."
        primaryTo="/games"
        primaryLabel="Browse all games"
        secondaryTo="/categories"
        secondaryLabel="Explore categories"
      />
    </>
  );
}
