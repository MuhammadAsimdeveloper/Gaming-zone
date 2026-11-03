import { Link } from 'react-router-dom';
import { ADS_ENABLED } from '../../config/site';
import { Logo } from '../brand/Logo';
import { Container } from '../ui/Container';

const columns = [
  {
    title: 'Play',
    links: [
      { to: '/games', label: 'All games' },
      { to: '/popular', label: 'Popular' },
      { to: '/new', label: 'New releases' },
      { to: '/categories', label: 'Categories' },
      { to: '/favorites', label: 'Favorites' },
      { to: '/recently-played', label: 'Recently played' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About us' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy policy' },
      { to: '/terms', label: 'Terms & conditions' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-line bg-raised/60">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
              Original browser games built to be played the second you land. No downloads, no
              account, no waiting.
            </p>
            <p className="mt-4 text-xs text-muted">100% free · No account required</p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/80">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="inline-flex min-h-6 items-center text-sm text-muted transition hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            © {year} NeonRift. Original games, built for the browser.
          </p>
          <p className="text-xs text-muted">
            {ADS_ENABLED
              ? 'Ads may be shown to keep every game free.'
              : 'No ads are served until advertising is configured.'}
          </p>
        </div>
      </Container>
    </footer>
  );
}
