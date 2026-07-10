import { Check } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

type WorkspaceListItemProps = {
  icon: ReactNode;
  isCurrent: boolean;
  isFocused?: boolean;
  onClick: () => void;
  subtitle?: string;
  title: string;
};

export const WorkspaceListItem = forwardRef<HTMLButtonElement, WorkspaceListItemProps>(
  function WorkspaceListItem(
    {
      icon,
      isCurrent,
      isFocused = false,
      onClick,
      subtitle,
      title,
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        aria-current={isCurrent ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          isCurrent && 'bg-brand/8',
          isFocused && 'ring-2 ring-brand',
        )}
        type="button"
        onClick={onClick}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand/12 text-sm font-bold text-brand">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {isCurrent ? (
          <div className="flex items-center gap-2">
            <Badge tone="brand">Atual</Badge>
            <Check className="text-brand" size={16} />
          </div>
        ) : null}
      </button>
    );
  },
);
