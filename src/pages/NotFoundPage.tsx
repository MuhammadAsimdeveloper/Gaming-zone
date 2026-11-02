import { ArrowRight, Gamepad2, House } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/seo/Seo';
import { ButtonLink } from '../components/ui/Button';
import { Container } from '../components/ui/Container';

const quickLinks = [
  { to: '/games', label: 'All games' },
  { to: '/categories', label: 'Categories' },
  { to: '/popular', label: 'Popular' },
  { to: '/new', label: 'New releases' },
];

export default function NotFoundPage() {
  return (
    <>
      <Seo
        title="Page Not Found"
        description="That page does not exist on NeonRift."
        path="/404"
        noIndex
      />
      <Container className="relative flex min-h-[72vh] flex-col items-center justify-center py-20 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 h-64 w-64 rounded-full bg-electric-500/10 blur-3xl"
        />
        <div className="relative">
          <p className="text-gradient font-display text-[104px] font-bold leading-none tracking-tighter sm:text-[140px]">
            404
          </p>
          <Gamepad2
            className="animate-float absolute -right-8 top-2 h-10 w-10 text-electric-400 sm:-right-12 sm:h-12 sm:w-12"
            aria-hidden="true"
          />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-ink sm:text-3xl">
          This level does not exist
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted">
          The page may have moved, or the link might be slightly off. The library is still right
          where you left it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/" size="lg">
            <House className="h-4 w-4" aria-hidden="true" />
            Back home
          </ButtonLink>
          <ButtonLink to="/games" variant="secondary" size="lg">
            Browse games
          </ButtonLink>
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
            >
              {link.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
