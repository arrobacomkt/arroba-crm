import type { WorkspaceDocument } from '@/types/database';

export type DocumentAttachment = {
  caption?: string | null;
  created_at: string;
  id: string;
  kind: 'file' | 'image';
  mime_type: string;
  name: string;
  size: number;
  uploaded_by: string | null;
  url: string;
};

export type DocumentVersion = {
  body: string;
  id: string;
  saved_at: string;
  title: string;
};

export type WorkspacePage = WorkspaceDocument & {
  attachments: DocumentAttachment[];
  cover_file_id: string | null;
  icon: string | null;
  is_pinned: boolean;
  last_opened_at: string | null;
  parent_document_id: string | null;
  position: number;
  versions: DocumentVersion[];
};

export type WorkspacePageWithContext = WorkspacePage & {
  accountName: string | null;
  projectTitle: string | null;
};

export type DocumentTreeNode = WorkspacePageWithContext & {
  children: DocumentTreeNode[];
};

export function normalizeWorkspacePage(
  document: Partial<WorkspacePageWithContext> & Pick<WorkspaceDocument, 'id'>,
): WorkspacePageWithContext {
  return {
    accountName: document.accountName ?? null,
    account_id: document.account_id ?? null,
    attachments: document.attachments ?? [],
    body: document.body ?? '',
    cover_file_id: document.cover_file_id ?? null,
    created_at: document.created_at ?? new Date().toISOString(),
    doc_type: document.doc_type ?? 'note',
    icon: document.icon ?? null,
    id: document.id,
    is_pinned: document.is_pinned ?? false,
    last_opened_at: document.last_opened_at ?? null,
    organization_id: document.organization_id ?? 'org-arroba-local',
    parent_document_id: document.parent_document_id ?? null,
    position: document.position ?? 0,
    project_id: document.project_id ?? null,
    projectTitle: document.projectTitle ?? null,
    status: document.status ?? 'draft',
    title: document.title ?? 'Sem titulo',
    updated_at: document.updated_at ?? new Date().toISOString(),
    updated_by: document.updated_by ?? null,
    versions: document.versions ?? [],
  };
}

export function sortPages(pages: WorkspacePageWithContext[]) {
  return [...pages].sort((first, second) => {
    if (first.position !== second.position) return first.position - second.position;
    return first.title.localeCompare(second.title, 'pt-BR');
  });
}

export function buildDocumentTree(pages: WorkspacePageWithContext[]) {
  const nodes = new Map<string, DocumentTreeNode>();
  const roots: DocumentTreeNode[] = [];

  for (const page of sortPages(pages)) {
    nodes.set(page.id, { ...page, children: [] });
  }

  for (const node of nodes.values()) {
    if (node.parent_document_id) {
      const parent = nodes.get(node.parent_document_id);
      if (parent && parent.id !== node.id) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  const sortNodes = (items: DocumentTreeNode[]) => {
    items.sort((first, second) => {
      if (first.position !== second.position) return first.position - second.position;
      return first.title.localeCompare(second.title, 'pt-BR');
    });
    for (const item of items) sortNodes(item.children);
  };

  sortNodes(roots);
  return roots;
}

export function collectDescendantIds(pages: WorkspacePageWithContext[], documentId: string) {
  const childrenByParent = new Map<string, string[]>();

  for (const page of pages) {
    if (!page.parent_document_id) continue;
    const siblings = childrenByParent.get(page.parent_document_id) ?? [];
    siblings.push(page.id);
    childrenByParent.set(page.parent_document_id, siblings);
  }

  const result = new Set<string>();
  const stack = [documentId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const children = childrenByParent.get(current) ?? [];
    for (const childId of children) {
      if (result.has(childId)) continue;
      result.add(childId);
      stack.push(childId);
    }
  }

  return Array.from(result);
}

export function buildDocumentBreadcrumbs(
  pages: WorkspacePageWithContext[],
  currentDocumentId: string | null,
) {
  if (!currentDocumentId) return [];

  const pageById = new Map(pages.map((page) => [page.id, page]));
  const items: WorkspacePageWithContext[] = [];
  const seen = new Set<string>();
  let current = pageById.get(currentDocumentId) ?? null;

  while (current && !seen.has(current.id)) {
    items.unshift(current);
    seen.add(current.id);
    current = current.parent_document_id ? (pageById.get(current.parent_document_id) ?? null) : null;
  }

  return items;
}

export function getDocumentPreview(body: string) {
  return body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPinnedPages(pages: WorkspacePageWithContext[]) {
  return sortPages(pages.filter((page) => page.is_pinned));
}

export function groupPagesByAccount(pages: WorkspacePageWithContext[]) {
  const groups = new Map<string, WorkspacePageWithContext[]>();

  for (const page of pages) {
    const key = page.accountName ?? 'Sem cliente';
    const items = groups.get(key) ?? [];
    items.push(page);
    groups.set(key, items);
  }

  return Array.from(groups.entries())
    .map(([label, items]) => ({ label, items: sortPages(items) }))
    .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'));
}

export function groupPagesByProject(pages: WorkspacePageWithContext[]) {
  const groups = new Map<string, WorkspacePageWithContext[]>();

  for (const page of pages) {
    const key = page.projectTitle ?? 'Sem projeto';
    const items = groups.get(key) ?? [];
    items.push(page);
    groups.set(key, items);
  }

  return Array.from(groups.entries())
    .map(([label, items]) => ({ label, items: sortPages(items) }))
    .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'));
}
