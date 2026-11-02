import { useMemo } from 'react';
import { AdRegion } from '../components/ads/AdRegion';
import { GameGrid } from '../components/game/GameGrid';
import { Seo } from '../components/seo/Seo';
import { Container } from '../components/ui/Container';
import { CtaBand } from '../components/ui/CtaBand';
import { PageHeader } from '../components/ui/PageHeader';
import { sortGames } from '../lib/catalogue';
import { useCatalogue } from '../providers/CatalogueProvider';

export default function PopularPage() {
  const { publishedGames } = useCatalogue();
  const games = useMemo(() => sortGames(publishedGames, 'popular'), [publishedGames]);

  return (
    <>
      <Seo
        title="Popular Games"
        description="NeonRift's curated shortlist of browser games to play first. Editorial favourites across arcade, puzzle, strategy and casual."
        path="/popular"
      />
      <PageHeader
        eyebrow="Curated favourites"
        title="Popular, by our own ranking"
        description="This order is editorial — a shortlist we recommend first. It is not a live play counter, and we do not invent one."
      />

      <Container className="py-8 sm:py-10">
        <AdRegion placement="listing-top" className="mb-8" />
        <GameGrid games={games} priorityCount={3} />
      </Container>

      <CtaBand
        title="Your next favorite might be newer than this list."
        description="Browse the full library or jump into the latest releases to see what just landed."
        primaryTo="/new"
        primaryLabel="See new releases"
        secondaryTo="/games"
        secondaryLabel="Browse all games"
      />
    </>
  );
}
