import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  brand: 'bg-brand/15 text-brand',
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
