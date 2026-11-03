import { Heart, History, Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { usePreferences } from '../../providers/PreferencesProvider';
import { Logo } from '../brand/Logo';
import { SearchBar } from '../search/SearchBar';
import { Container } from '../ui/Container';

const primaryNav = [
  { to: '/games', label: 'All Games' },
  { to: '/popular', label: 'Popular' },
  { to: '/new', label: 'New' },
  { to: '/categories', label: 'Categories' },
];

const secondaryNav = [
  { to: '/favorites', label: 'Favorites' },
  { to: '/recently-played', label: 'Recently played' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const iconLinkClasses =
  'relative grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-ink';

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { favorites } = usePreferences();
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-xl">
      <Container className="flex h-16 items-center gap-3 sm:h-[72px]">
        <Logo />

        <nav aria-label="Primary" className="ml-5 hidden items-center gap-1 lg:flex">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3.5 py-2 text-sm font-medium transition',
                  isActive ? 'bg-ink text-surface' : 'text-muted hover:bg-sunken hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <div className="hidden w-64 md:block lg:w-72">
            <SearchBar id="header-search" shortcut />
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className={cn(iconLinkClasses, 'md:hidden')}
            aria-label={searchOpen ? 'Close search' : 'Search games'}
            aria-expanded={searchOpen}
          >
            {searchOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Search className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <Link to="/favorites" className={iconLinkClasses} aria-label={`Favorites (${favorites.length})`}>
            <Heart className="h-5 w-5" aria-hidden="true" />
            {favorites.length > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-surface">
                {favorites.length > 9 ? '9+' : favorites.length}
              </span>
            ) : null}
          </Link>

          <Link
            to="/recently-played"
            className={cn(iconLinkClasses, 'hidden sm:grid')}
            aria-label="Recently played"
          >
            <History className="h-5 w-5" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className={cn(iconLinkClasses, 'lg:hidden')}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </Container>

      {searchOpen ? (
        <div className="border-t border-line px-4 py-3 md:hidden">
          <SearchBar id="mobile-search" onSubmitted={() => setSearchOpen(false)} />
        </div>
      ) : null}

      {mobileOpen ? (
        <div id="mobile-nav" className="border-t border-line bg-raised lg:hidden">
          <Container className="py-4">
            <nav aria-label="Mobile" className="grid grid-cols-2 gap-2">
              {[...primaryNav, ...secondaryNav].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-xl px-3.5 py-3 text-sm font-medium transition',
                      isActive ? 'bg-ink text-surface' : 'text-muted hover:bg-sunken hover:text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
