import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { WorkspacePageWithContext } from './documents-workspace';

type DocumentBreadcrumbProps = {
  items: WorkspacePageWithContext[];
};

export function DocumentBreadcrumb({ items }: DocumentBreadcrumbProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-muted hover:text-foreground"
        to="/app/documentos"
      >
        <Home size={14} />
        Workspace
      </Link>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1">
          <ChevronRight size={14} />
          <Link
            className="rounded-md px-2 py-1 transition hover:bg-muted hover:text-foreground"
            to={`/app/documentos/pagina/${item.id}`}
          >
            {item.title}
          </Link>
        </div>
      ))}
    </div>
  );
}
