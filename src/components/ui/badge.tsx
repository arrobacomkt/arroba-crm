import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  brand: 'bg-blue-100 text-blue-700',
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
