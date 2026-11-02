import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-electric-500 to-plasma-500 text-white shadow-[0_10px_34px_-12px_rgba(76,141,255,0.75)] ring-1 ring-white/15 hover:brightness-110',
  secondary:
    'border border-white/10 bg-white/[0.055] text-ink hover:border-white/20 hover:bg-white/[0.09]',
  ghost: 'text-muted hover:bg-white/[0.06] hover:text-ink',
  outline: 'border border-electric-500/40 bg-electric-500/5 text-electric-300 hover:bg-electric-500/12',
  danger: 'border border-coral/30 bg-coral/10 text-coral hover:bg-coral/20',
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
