import type { ReactNode } from 'react';
import { Container } from './Container';

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-line">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(680px 260px at 18% -20%, color-mix(in srgb, var(--nr-brand) 16%, transparent), transparent 70%), radial-gradient(520px 220px at 82% 0%, color-mix(in srgb, var(--nr-accent) 12%, transparent), transparent 70%)',
        }}
      />
      <Container className="relative py-12 sm:py-16">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold text-ink sm:text-4xl lg:text-[2.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-[15px]">{description}</p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </Container>
    </div>
  );
}
