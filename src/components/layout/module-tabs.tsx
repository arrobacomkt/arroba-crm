import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils/cn';

export type ModuleTab = {
  badge?: number | string;
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  to: string;
};

type ModuleTabsProps = {
  tabs: ModuleTab[];
};

export function ModuleTabs({ tabs }: ModuleTabsProps) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <div className="inline-flex min-w-full gap-1 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.disabled) {
            return (
              <span
                key={tab.to}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground/70"
              >
                {Icon ? <Icon size={16} /> : null}
                {tab.label}
                {tab.badge !== undefined ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{tab.badge}</span>
                ) : null}
              </span>
            );
          }

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
                  isActive
                    ? 'border-[#F7622A] bg-[#F7622A]/10 text-[#F7622A]'
                    : 'border-border bg-card text-muted-foreground hover:border-brand/30 hover:bg-muted hover:text-foreground',
                )
              }
              end
            >
              {Icon ? <Icon size={16} /> : null}
              {tab.label}
              {tab.badge !== undefined ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                  {tab.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
