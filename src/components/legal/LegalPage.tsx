import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Seo } from '../seo/Seo';
import { Container } from '../ui/Container';
import { PageHeader } from '../ui/PageHeader';

export function LegalPage({
  title,
  description,
  path,
  updated,
  children,
}: {
  title: string;
  description: string;
  path: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <Seo title={title} description={description} path={path} />
      <PageHeader eyebrow="Legal" title={title} description={description} />
      <Container className="py-10 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs text-muted">Last updated {updated}</p>
          <div className="mt-8 space-y-10 text-sm leading-7 text-muted">{children}</div>
          <div className="mt-12 flex gap-3 rounded-2xl border border-warning/25 bg-warning/10 p-5 text-sm leading-6 text-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              This document is a practical starting point for an independent project, not legal
              advice. Have it reviewed by a qualified professional before commercial launch,
              advertising is enabled, or the platform starts handling personal data at scale.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}

export function LegalSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-heading` : undefined}>
      <h2 id={id ? `${id}-heading` : undefined} className="font-display text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
