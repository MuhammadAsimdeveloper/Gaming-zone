import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

export function SectionHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  actionTo,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-electric-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actionLabel && actionTo ? (
        <Link
          to={actionTo}
          className="group inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-sm font-medium text-muted transition hover:text-ink"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
