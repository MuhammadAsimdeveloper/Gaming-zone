import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export type GameAccent = 'electric' | 'plasma' | 'mint' | 'coral';

const accentTokens: Record<GameAccent, { icon: string; dot: string; glow: string }> = {
  electric: {
    icon: 'bg-electric-500/12 text-electric-300 ring-electric-500/30',
    dot: 'bg-electric-400',
    glow: 'bg-electric-500/15',
  },
  plasma: {
    icon: 'bg-plasma-500/12 text-plasma-300 ring-plasma-500/30',
    dot: 'bg-plasma-400',
    glow: 'bg-plasma-500/15',
  },
  mint: {
    icon: 'bg-mint/10 text-mint ring-mint/25',
    dot: 'bg-mint',
    glow: 'bg-mint/10',
  },
  coral: {
    icon: 'bg-coral/10 text-coral ring-coral/25',
    dot: 'bg-coral',
    glow: 'bg-coral/10',
  },
};

interface GameFrameProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: GameAccent;
  toolbar?: ReactNode;
  hud?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function GameFrame({
  title,
  subtitle,
  icon: Icon,
  accent = 'electric',
  toolbar,
  hud,
  footer,
  children,
  className,
}: GameFrameProps) {
  const headingId = useId();
  const tokens = accentTokens[accent];

  return (
    <section
      aria-labelledby={headingId}
      data-game-frame=""
      tabIndex={-1}
      className={cn(
        'relative flex min-h-[420px] w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-night-900/90 text-ink shadow-[0_30px_80px_-40px_rgba(5,8,20,0.95)]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute -top-24 right-[-10%] h-56 w-80 rounded-full blur-3xl', tokens.glow)}
      />
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1', tokens.icon)}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              <span className={cn('h-1.5 w-1.5 rounded-full', tokens.dot)} aria-hidden="true" />
              NeonRift Arcade
            </p>
            <h2 id={headingId} className="truncate text-base font-semibold text-ink sm:text-lg">
              {title}
            </h2>
            {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
          </div>
        </div>
        {toolbar ? <div className="flex shrink-0 items-center gap-2">{toolbar}</div> : null}
      </header>

      {hud ? <div className="relative z-10 border-b border-white/5 px-3 py-2.5">{hud}</div> : null}

      <div className="relative z-10 flex flex-1 flex-col gap-3 p-3 sm:p-4">{children}</div>

      {footer ? (
        <div className="relative z-10 border-t border-white/5 px-4 py-2.5 text-[11px] leading-relaxed text-muted">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

type StatTone = 'ink' | 'mint' | 'coral' | 'electric' | 'plasma';

const statToneClasses: Record<StatTone, string> = {
  ink: 'text-ink',
  mint: 'text-mint',
  coral: 'text-coral',
  electric: 'text-electric-300',
  plasma: 'text-plasma-300',
};

export function GameStat({
  label,
  value,
  tone = 'ink',
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 rounded-2xl border border-white/10 bg-night-850/70 px-3 py-2', className)}>
      <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={cn('truncate font-display text-sm font-semibold tabular-nums sm:text-base', statToneClasses[tone])}>
        {value}
      </p>
    </div>
  );
}

type GameButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type GameButtonSize = 'sm' | 'md' | 'icon';

const buttonVariantClasses: Record<GameButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-electric-500 to-plasma-500 text-white shadow-[0_8px_26px_-12px_rgba(76,141,255,0.8)] ring-1 ring-white/15 hover:brightness-110',
  secondary:
    'border border-white/10 bg-white/5 text-ink hover:border-white/20 hover:bg-white/10',
  ghost: 'text-muted hover:bg-white/5 hover:text-ink',
  danger: 'border border-coral/30 bg-coral/10 text-coral hover:bg-coral/20',
};

const buttonSizeClasses: Record<GameButtonSize, string> = {
  sm: 'h-8 px-3 text-xs [@media(pointer:coarse)]:h-11',
  md: 'h-10 px-4 text-sm',
  icon: 'h-9 w-9 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11',
};

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
}

export function GameButton({ variant = 'secondary', size = 'md', className, type, ...props }: GameButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}

export function GameOverlay({
  children,
  className,
  tone = 'default',
  label = 'Game status',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'win' | 'loss';
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    return () => {
      const frame = document.querySelector<HTMLElement>('[data-game-frame]');
      if (frame?.isConnected) frame.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={cn(
        'absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-night-950/90 p-4 text-center backdrop-blur-sm',
        tone === 'win' && 'border-mint/25',
        tone === 'loss' && 'border-coral/25',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function GameSegmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
}: {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-night-850/80 p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40',
              active
                ? 'bg-electric-500/20 text-electric-200 ring-1 ring-electric-500/30'
                : 'text-muted hover:bg-white/5 hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-ink">
      {children}
    </kbd>
  );
}
