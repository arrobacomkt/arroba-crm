import type { ReactNode } from 'react';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ModuleTabs, type ModuleTab } from '@/components/layout/module-tabs';

type BreadcrumbItem = {
  label: string;
  to?: string;
};

type ModulePageLayoutProps = {
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
  description: string;
  tabs?: ModuleTab[];
  title: string;
};

export function ModulePageLayout({
  actions,
  breadcrumbs = [],
  children,
  description,
  tabs,
  title,
}: ModulePageLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {tabs?.length ? <ModuleTabs tabs={tabs} /> : null}
      </div>
      {children}
    </div>
  );
}
