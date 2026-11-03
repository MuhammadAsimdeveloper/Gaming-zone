import { Heart } from 'lucide-react';
import { useMemo } from 'react';
import { GameGrid } from '../components/game/GameGrid';
import { Seo } from '../components/seo/Seo';
import { ButtonLink } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useCatalogue } from '../providers/CatalogueProvider';
import { usePreferences } from '../providers/PreferencesProvider';
import type { Game } from '../types/game';

export default function FavoritesPage() {
  const { favorites } = usePreferences();
  const { getGameById } = useCatalogue();

  const games = useMemo(
    () =>
      favorites
        .map((id) => getGameById(id))
        .filter((game): game is Game => Boolean(game?.published)),
    [favorites, getGameById],
  );

  return (
    <>
      <Seo
        title="Your Favorites"
        description="The browser games you saved on this device."
        path="/favorites"
        noIndex
      />
      <PageHeader
        eyebrow="Your library"
        title="Favorites"
        description="Saved in this browser, not on a server. Tap the heart on any game card to add or remove it."
      />

      <Container className="py-8 sm:py-10">
        {games.length > 0 ? (
          <>
            <GameGrid games={games} />
            <p className="mt-8 text-xs leading-5 text-muted">
              Favorites live in this browser's local storage. Clearing site data or switching devices
              starts a fresh list.
            </p>
          </>
        ) : (
          <EmptyState
            icon={Heart}
            title="No favorites yet"
            description="Tap the heart on any game card to keep it here. Favorites are stored locally on this device and never leave your browser."
            action={
              <ButtonLink to="/games">
                Find something to play
              </ButtonLink>
            }
          />
        )}
      </Container>
    </>
  );
}
