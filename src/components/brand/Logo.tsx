import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

export function Logo({ className }: { className?: string }) {
  const gradientId = useId().replace(/:/g, '');

  return (
    <Link
      to="/"
      aria-label="NeonRift home"
      className={cn('group inline-flex items-center gap-2.5 rounded-xl', className)}
    >
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl shadow-lg shadow-electric-500/25 ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-105">
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4c8dff" />
              <stop offset="1" stopColor="#a06bff" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" fill={`url(#${gradientId})`} />
          <path
            d="M18 46L46 18"
            stroke="#ffffff"
            strokeOpacity="0.22"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path d="M24 17.5L47 32L24 46.5Z" fill="#ffffff" />
        </svg>
      </span>
      <span className="font-display text-[19px] font-semibold tracking-tight text-ink">
        Neon<span className="text-gradient">Rift</span>
      </span>
    </Link>
  );
}
