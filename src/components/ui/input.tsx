import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition',
          'placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20',
          className,
        )}
        {...props}
      />
    );
  },
);
