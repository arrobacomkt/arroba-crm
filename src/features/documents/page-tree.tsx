import { ChevronDown, ChevronRight, Plus, Star } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

import { resolveDocumentIcon } from './document-icon';
import type { DocumentTreeNode } from './documents-workspace';

type PageTreeProps = {
  activeDocumentId: string | null;
  favoriteIds: string[];
  nodes: DocumentTreeNode[];
  onCreateSubpage: (parentId: string) => void;
  onOpen: (documentId: string) => void;
  onToggleFavorite: (documentId: string) => void;
};

export function PageTree({
  activeDocumentId,
  favoriteIds,
  nodes,
  onCreateSubpage,
  onOpen,
  onToggleFavorite,
}: PageTreeProps) {
  const defaultExpanded = useMemo(() => {
    const ids = new Set<string>();

    const visit = (items: DocumentTreeNode[]) => {
      for (const item of items) {
        if (item.children.length > 0) ids.add(item.id);
        visit(item.children);
      }
    };

    visit(nodes);
    return ids;
  }, [nodes]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(defaultExpanded);

  function toggleExpanded(documentId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <PageTreeItem
          key={node.id}
          activeDocumentId={activeDocumentId}
          expandedIds={expandedIds}
          favoriteIds={favoriteIds}
          level={0}
          node={node}
          onCreateSubpage={onCreateSubpage}
          onOpen={onOpen}
          onToggleExpanded={toggleExpanded}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

type PageTreeItemProps = {
  activeDocumentId: string | null;
  expandedIds: Set<string>;
  favoriteIds: string[];
  level: number;
  node: DocumentTreeNode;
  onCreateSubpage: (parentId: string) => void;
  onOpen: (documentId: string) => void;
  onToggleExpanded: (documentId: string) => void;
  onToggleFavorite: (documentId: string) => void;
};

function PageTreeItem({
  activeDocumentId,
  expandedIds,
  favoriteIds,
  level,
  node,
  onCreateSubpage,
  onOpen,
  onToggleExpanded,
  onToggleFavorite,
}: PageTreeItemProps) {
  const Icon = resolveDocumentIcon(node.icon);
  const isExpanded = expandedIds.has(node.id);
  const isActive = activeDocumentId === node.id;
  const isFavorite = favoriteIds.includes(node.id);

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition',
          isActive ? 'bg-brand/12 text-foreground' : 'hover:bg-muted/70',
        )}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
      >
        <button
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
          type="button"
          onClick={() => (node.children.length > 0 ? onToggleExpanded(node.id) : onOpen(node.id))}
        >
          {node.children.length > 0 ? (
            isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="inline-block h-3 w-3 rounded-full bg-border" />
          )}
        </button>

        <button
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          type="button"
          onClick={() => onOpen(node.id)}
        >
          <Icon className="shrink-0 text-muted-foreground" size={15} />
          <span className="truncate">{node.title}</span>
        </button>

        <div className="hidden items-center gap-1 group-hover:flex">
          <Button
            className="h-7 w-7 px-0"
            title="Favoritar"
            type="button"
            variant="ghost"
            onClick={() => onToggleFavorite(node.id)}
          >
            <Star className={cn(isFavorite && 'fill-brand text-brand')} size={14} />
          </Button>
          <Button
            className="h-7 w-7 px-0"
            title="Nova subpagina"
            type="button"
            variant="ghost"
            onClick={() => onCreateSubpage(node.id)}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>

      {isExpanded && node.children.length > 0 ? (
        <div className="space-y-1">
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              activeDocumentId={activeDocumentId}
              expandedIds={expandedIds}
              favoriteIds={favoriteIds}
              level={level + 1}
              node={child}
              onCreateSubpage={onCreateSubpage}
              onOpen={onOpen}
              onToggleExpanded={onToggleExpanded}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
