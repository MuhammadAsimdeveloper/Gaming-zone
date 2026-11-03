import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../../lib/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-ink text-surface shadow-[4px_4px_0_0_rgba(20,22,28,0.22)] hover:bg-brand hover:text-white night:bg-gradient-to-r night:from-electric-500 night:to-plasma-500 night:text-night-950 night:hover:text-night-950 night:shadow-[0_10px_34px_-12px_rgba(76,141,255,0.75)] night:ring-1 night:ring-white/15',
  secondary:
    'border border-line bg-raised text-ink hover:border-ink/30 hover:bg-sunken',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  outline: 'border border-brand/40 bg-brand/5 text-brand hover:bg-brand/10',
  danger: 'border border-coral/30 bg-coral/10 text-coral hover:bg-coral/20',
  inverse: 'bg-surface text-ink hover:bg-brand hover:text-surface',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-[15px]',
  icon: 'h-10 w-10',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = 'primary', size = 'md', className, type, ...props }: ButtonProps) {
  return (
    <button type={type ?? 'button'} className={buttonClasses(variant, size, className)} {...props} />
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
