import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-brand',
  secondary: 'border border-border bg-card text-foreground hover:bg-muted focus-visible:ring-brand',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-brand',
  success: 'bg-success text-white hover:bg-success/90 focus-visible:ring-success',
  danger: 'bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger',
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
