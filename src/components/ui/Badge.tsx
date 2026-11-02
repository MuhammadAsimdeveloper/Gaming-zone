import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'electric' | 'plasma' | 'mint' | 'amber' | 'coral';

const toneClasses: Record<Tone, string> = {
  neutral: 'border-white/10 bg-white/[0.07] text-muted',
  electric: 'border-electric-500/30 bg-electric-500/10 text-electric-300',
  plasma: 'border-plasma-500/30 bg-plasma-500/10 text-plasma-300',
  mint: 'border-mint/25 bg-mint/10 text-mint',
  amber: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
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
