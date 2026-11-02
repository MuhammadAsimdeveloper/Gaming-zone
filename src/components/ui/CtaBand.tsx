import { ArrowRight } from 'lucide-react';
import { Container } from './Container';
import { ButtonLink } from './Button';

export function CtaBand({
  eyebrow = 'Jump in',
  title,
  description,
  primaryTo,
  primaryLabel,
  secondaryTo,
  secondaryLabel,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  primaryTo: string;
  primaryLabel: string;
  secondaryTo?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="mt-16 sm:mt-20">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-electric-500/[0.14] via-night-850 to-plasma-500/[0.13] p-8 sm:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-electric-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-plasma-500/15 blur-3xl"
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-electric-300">
                {eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to={primaryTo} size="lg">
                {primaryLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              {secondaryTo && secondaryLabel ? (
                <ButtonLink to={secondaryTo} variant="secondary" size="lg">
                  {secondaryLabel}
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
