import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ConsentBanner } from './components/analytics/ConsentBanner';
import { SiteLayout } from './components/layout/SiteLayout';
import { Container } from './components/ui/Container';
import { initializeAnalytics } from './lib/analytics';
import { CatalogueProvider } from './providers/CatalogueProvider';
import { PreferencesProvider } from './providers/PreferencesProvider';
import { ToastProvider } from './providers/ToastProvider';

const HomePage = lazy(() => import('./pages/HomePage'));
const GamesPage = lazy(() => import('./pages/GamesPage'));
const PopularPage = lazy(() => import('./pages/PopularPage'));
const NewPage = lazy(() => import('./pages/NewPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const RecentlyPlayedPage = lazy(() => import('./pages/RecentlyPlayedPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RouteFallback() {
  return (
    <Container className="py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-electric-400" />
        <p className="mt-4 text-sm text-muted">Loading the rift…</p>
      </div>
    </Container>
  );
}

function AnalyticsInitializer() {
  useEffect(() => {
    initializeAnalytics();
  }, []);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <PreferencesProvider>
        <CatalogueProvider>
          <BrowserRouter>
            <AnalyticsInitializer />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route element={<SiteLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="games" element={<GamesPage />} />
                  <Route path="popular" element={<PopularPage />} />
                  <Route path="new" element={<NewPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="category/:categoryId" element={<CategoryPage />} />
                  <Route path="game/:slug" element={<GamePage />} />
                  <Route path="favorites" element={<FavoritesPage />} />
                  <Route path="recently-played" element={<RecentlyPlayedPage />} />
                  <Route path="about" element={<AboutPage />} />
                  <Route path="contact" element={<ContactPage />} />
                  <Route path="privacy" element={<PrivacyPage />} />
                  <Route path="terms" element={<TermsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Suspense>
            <ConsentBanner />
          </BrowserRouter>
        </CatalogueProvider>
      </PreferencesProvider>
    </ToastProvider>
  );
}
