import { ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type WorkspaceSwitcherButtonProps = {
  icon: ReactNode;
  isCollapsed?: boolean;
  isOpen: boolean;
  label: string;
  onClick: () => void;
  subtitle?: string;
};

export function WorkspaceSwitcherButton({
  icon,
  isCollapsed = false,
  isOpen,
  label,
  onClick,
  subtitle,
}: WorkspaceSwitcherButtonProps) {
  return (
    <button
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar px-3 py-3 text-left transition-colors',
        'hover:bg-sidebar-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        isOpen && 'bg-sidebar-accent/70',
        isCollapsed && 'justify-center px-2',
      )}
      type="button"
      onClick={onClick}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand/15 text-sm font-bold text-brand">
        {icon}
      </div>

      {!isCollapsed ? (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">{label}</p>
            <p className="truncate text-xs text-sidebar-muted">{subtitle ?? 'Workspace ativo'}</p>
          </div>
          <ChevronsUpDown className="shrink-0 text-sidebar-muted" size={16} />
        </>
      ) : null}
    </button>
  );
}
