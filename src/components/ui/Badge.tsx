import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'electric' | 'plasma' | 'mint' | 'amber' | 'coral';

const toneClasses: Record<Tone, string> = {
  neutral: 'border-line bg-raised text-muted',
  electric: 'border-brand/30 bg-brand/10 text-brand',
  plasma: 'border-plasma-500/30 bg-plasma-500/10 text-plasma-300',
  mint: 'border-mint/25 bg-mint/10 text-mint',
  amber: 'border-warning/25 bg-warning/10 text-warning',
  coral: 'border-coral/25 bg-coral/10 text-coral',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
