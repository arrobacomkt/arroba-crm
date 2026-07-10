import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock3,
  FileText,
  FolderArchive,
  Loader2,
  Plus,
  Search,
  Star,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';

import { DocumentBreadcrumb } from './document-breadcrumb';
import { DocumentEditor } from './document-editor';
import { DocumentHome } from './document-home';
import {
  archiveLocalDocument,
  createLocalDocument,
  duplicateLocalDocument,
  loadLocalDocumentWorkspace,
  toggleLocalDocumentFavorite,
  updateLocalDocument,
  type LocalDocumentWorkspace,
} from './documents-data';
import {
  archiveDocuments,
  createDocument,
  documentsWorkspaceQueryKey,
  fetchDocumentsWorkspace,
  updateDocument,
} from './documents-queries';
import {
  buildDocumentBreadcrumbs,
  buildDocumentTree,
  collectDescendantIds,
  getPinnedPages,
  groupPagesByAccount,
  groupPagesByProject,
  type WorkspacePageWithContext,
} from './documents-workspace';
import { PageTree } from './page-tree';

type DocumentsRemoteUiState = {
  lastOpenedDocumentId: string | null;
  recentDocumentIds: string[];
};

const remoteUiStorageKey = 'arrobaco.documents.remote-ui.v1';

const documentTemplates = [
  {
    label: 'Briefing',
    title: 'Novo briefing',
    docType: 'briefing' as const,
    body: '<h1>Novo briefing</h1><ul><li>Objetivo</li><li>Escopo</li><li>Publico</li></ul>',
  },
  {
    label: 'Roteiro',
    title: 'Novo roteiro',
    docType: 'script' as const,
    body: '<h1>Novo roteiro</h1><p>Abertura</p><ul><li>Gancho</li><li>Bloco principal</li><li>CTA</li></ul>',
  },
  {
    label: 'Calendario',
    title: 'Calendario editorial',
    docType: 'note' as const,
    body: '<h1>Calendario editorial</h1><h2>Semana 1</h2><ul><li>Reel</li><li>Stories</li></ul>',
  },
];

export function DocumentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { documentId, accountId, projectId } = useParams();
  const { isSupabaseConfigured, user } = useAuth();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';
  const [localWorkspace, setLocalWorkspace] = useState<LocalDocumentWorkspace>(() =>
    loadLocalDocumentWorkspace(),
  );
  const [remoteUi, setRemoteUi] = useState<DocumentsRemoteUiState>(() => readRemoteUiState());
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: documentsWorkspaceQueryKey,
    queryFn: fetchDocumentsWorkspace,
    enabled: hasRealSession,
  });

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsWorkspaceQueryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsWorkspaceQueryKey });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveDocuments,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsWorkspaceQueryKey });
    },
  });

  const workspace = useMemo(() => {
    if (!hasRealSession) return localWorkspace;

    const data = workspaceQuery.data ?? { accounts: [], documents: [], projects: [] };
    return {
      accounts: data.accounts,
      documents: data.documents,
      favoriteIds: data.documents.filter((document) => document.is_pinned).map((document) => document.id),
      lastOpenedDocumentId: remoteUi.lastOpenedDocumentId,
      projects: data.projects,
      recentViews: remoteUi.recentDocumentIds.map((id) => ({
        document_id: id,
        user_id: user?.id ?? 'remote-user',
        viewed_at: '',
      })),
    };
  }, [hasRealSession, localWorkspace, remoteUi.lastOpenedDocumentId, remoteUi.recentDocumentIds, user?.id, workspaceQuery.data]);

  const routeMode = useMemo(() => {
    if (location.pathname.includes('/favoritos')) return 'favoritos' as const;
    if (location.pathname.includes('/recentes')) return 'recentes' as const;
    if (location.pathname.includes('/arquivados')) return 'arquivados' as const;
    if (location.pathname.includes('/cliente/')) return 'cliente' as const;
    if (location.pathname.includes('/projeto/')) return 'projeto' as const;
    if (location.pathname.includes('/pagina/')) return 'pagina' as const;
    return 'home' as const;
  }, [location.pathname]);

  const selectedDocument = useMemo(
    () => workspace.documents.find((document) => document.id === documentId) ?? null,
    [documentId, workspace.documents],
  );

  const favoriteIds = workspace.favoriteIds;
  const archivedPages = workspace.documents.filter((document) => document.status === 'archived');
  const activePages = workspace.documents.filter((document) => document.status !== 'archived');
  const recentPages = getRecentPages(workspace.documents, hasRealSession ? remoteUi.recentDocumentIds : workspace.recentViews.map((view) => view.document_id));
  const favoritePages = getPinnedPages(
    workspace.documents.filter((document) => favoriteIds.includes(document.id)),
  );

  const contextPages = useMemo(() => {
    switch (routeMode) {
      case 'arquivados':
        return archivedPages;
      case 'favoritos':
        return favoritePages;
      case 'recentes':
        return recentPages;
      case 'cliente':
        return activePages.filter((document) => document.account_id === accountId);
      case 'projeto':
        return activePages.filter((document) => document.project_id === projectId);
      default:
        return activePages;
    }
  }, [accountId, activePages, archivedPages, favoritePages, projectId, recentPages, routeMode]);

  const filteredSidebarPages = useMemo(() => {
    const normalizedSearch = sidebarSearch.trim().toLowerCase();
    if (!normalizedSearch) return contextPages;

    return contextPages.filter((document) =>
      [document.title, document.body, document.accountName ?? '', document.projectTitle ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [contextPages, sidebarSearch]);

  const tree = useMemo(() => buildDocumentTree(filteredSidebarPages), [filteredSidebarPages]);
  const breadcrumbs = useMemo(
    () => buildDocumentBreadcrumbs(workspace.documents, selectedDocument?.id ?? null),
    [selectedDocument?.id, workspace.documents],
  );
  const groupedByAccount = useMemo(() => groupPagesByAccount(activePages), [activePages]);
  const groupedByProject = useMemo(() => groupPagesByProject(activePages), [activePages]);

  useEffect(() => {
    if (routeMode !== 'home') return;
    if (searchParams.get('home') === '1') return;

    const lastOpenedId = workspace.lastOpenedDocumentId;
    if (lastOpenedId && workspace.documents.some((document) => document.id === lastOpenedId)) {
      navigate(`/app/documentos/pagina/${lastOpenedId}`, { replace: true });
    }
  }, [navigate, routeMode, searchParams, workspace.documents, workspace.lastOpenedDocumentId]);

  function persistRemoteUi(nextState: DocumentsRemoteUiState) {
    setRemoteUi(nextState);
    window.localStorage.setItem(remoteUiStorageKey, JSON.stringify(nextState));
  }

  function markDocumentAsOpened(document: WorkspacePageWithContext) {
    if (hasRealSession) {
      persistRemoteUi({
        lastOpenedDocumentId: document.id,
        recentDocumentIds: [document.id, ...remoteUi.recentDocumentIds.filter((id) => id !== document.id)].slice(0, 20),
      });
      return;
    }

    setLocalWorkspace((current) =>
      updateLocalDocument(current, {
        accountId: document.account_id,
        attachments: document.attachments,
        body: document.body,
        docId: document.id,
        docType: document.doc_type,
        icon: document.icon,
        isPinned: document.is_pinned,
        parentDocumentId: document.parent_document_id,
        projectId: document.project_id,
        status: document.status,
        title: document.title,
      }),
    );
  }

  function openDocument(documentIdToOpen: string) {
    const document = workspace.documents.find((item) => item.id === documentIdToOpen);
    if (!document) return;
    markDocumentAsOpened(document);
    navigate(`/app/documentos/pagina/${documentIdToOpen}`);
  }

  async function handleCreatePage(template?: (typeof documentTemplates)[number], parentDocumentId?: string | null) {
    const defaultAccountId = selectedDocument?.account_id ?? accountId ?? workspace.accounts[0]?.id ?? null;
    const defaultProjectId =
      selectedDocument?.project_id ??
      projectId ??
      workspace.projects.find((project) => project.account_id === defaultAccountId)?.id ??
      null;

    const payload = {
      accountId: defaultAccountId,
      body: template?.body ?? '<h1>Nova pagina</h1><p>Comece a escrever aqui.</p>',
      docType: template?.docType ?? ('note' as const),
      icon: 'FileText',
      parentDocumentId: parentDocumentId ?? null,
      projectId: defaultProjectId,
      status: 'draft' as const,
      title: template?.title ?? 'Nova pagina',
    };

    try {
      if (hasRealSession) {
        const created = await createMutation.mutateAsync(payload);
        persistRemoteUi({
          lastOpenedDocumentId: created.id,
          recentDocumentIds: [created.id, ...remoteUi.recentDocumentIds.filter((id) => id !== created.id)].slice(0, 20),
        });
        navigate(`/app/documentos/pagina/${created.id}`);
      } else {
        const nextWorkspace = createLocalDocument(localWorkspace, payload);
        setLocalWorkspace(nextWorkspace);
        const nextDocument = nextWorkspace.documents[0];
        if (nextDocument) navigate(`/app/documentos/pagina/${nextDocument.id}`);
      }
      toast.success(parentDocumentId ? 'Subpagina criada.' : 'Pagina criada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel criar a pagina.');
    }
  }

  async function handleToggleFavorite(document: WorkspacePageWithContext) {
    try {
      if (hasRealSession) {
        await updateMutation.mutateAsync({
          accountId: document.account_id,
          body: document.body,
          docId: document.id,
          docType: document.doc_type,
          icon: document.icon,
          isPinned: !document.is_pinned,
          parentDocumentId: document.parent_document_id,
          position: document.position,
          projectId: document.project_id,
          status: document.status,
          title: document.title,
        });
      } else {
        setLocalWorkspace((current) => toggleLocalDocumentFavorite(current, document.id));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar favorito.');
    }
  }

  async function handleSaveDocument(
    currentDocument: WorkspacePageWithContext,
    payload: {
      accountId: string | null;
      attachments: WorkspacePageWithContext['attachments'];
      body: string;
      docType: WorkspacePageWithContext['doc_type'];
      icon: string | null;
      isPinned: boolean;
      parentDocumentId: string | null;
      projectId: string | null;
      status: WorkspacePageWithContext['status'];
      title: string;
    },
  ) {
    const didChange =
      currentDocument.title !== payload.title ||
      currentDocument.body !== payload.body ||
      currentDocument.doc_type !== payload.docType ||
      currentDocument.status !== payload.status ||
      currentDocument.account_id !== payload.accountId ||
      currentDocument.project_id !== payload.projectId ||
      currentDocument.parent_document_id !== payload.parentDocumentId ||
      currentDocument.is_pinned !== payload.isPinned ||
      currentDocument.attachments.length !== payload.attachments.length;

    if (!didChange) return;

    setIsSaving(true);
    try {
      if (hasRealSession) {
        await updateMutation.mutateAsync({
          accountId: payload.accountId,
          body: payload.body,
          docId: currentDocument.id,
          docType: payload.docType,
          icon: payload.icon,
          isPinned: payload.isPinned,
          parentDocumentId: payload.parentDocumentId,
          position: currentDocument.position,
          projectId: payload.projectId,
          status: payload.status,
          title: payload.title,
        });
      } else {
        setLocalWorkspace((current) =>
          updateLocalDocument(current, {
            accountId: payload.accountId,
            attachments: payload.attachments,
            body: payload.body,
            docId: currentDocument.id,
            docType: payload.docType,
            icon: payload.icon,
            isPinned: payload.isPinned,
            parentDocumentId: payload.parentDocumentId,
            projectId: payload.projectId,
            status: payload.status,
            title: payload.title,
          }),
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar a pagina.');
    } finally {
      window.setTimeout(() => setIsSaving(false), 250);
    }
  }

  async function handleDuplicateDocument(document: WorkspacePageWithContext) {
    try {
      if (hasRealSession) {
        const created = await createMutation.mutateAsync({
          accountId: document.account_id,
          body: document.body,
          docType: document.doc_type,
          icon: document.icon,
          parentDocumentId: document.parent_document_id,
          projectId: document.project_id,
          status: 'draft',
          title: `${document.title} (copia)`,
        });
        navigate(`/app/documentos/pagina/${created.id}`);
      } else {
        const nextWorkspace = duplicateLocalDocument(localWorkspace, document.id);
        setLocalWorkspace(nextWorkspace);
        const duplicated = nextWorkspace.documents[0];
        if (duplicated) navigate(`/app/documentos/pagina/${duplicated.id}`);
      }
      toast.success('Pagina duplicada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel duplicar a pagina.');
    }
  }

  async function handleToggleArchive(document: WorkspacePageWithContext) {
    if (document.status === 'archived') {
      return handleSaveDocument(document, {
        accountId: document.account_id,
        attachments: document.attachments,
        body: document.body,
        docType: document.doc_type,
        icon: document.icon,
        isPinned: document.is_pinned,
        parentDocumentId: document.parent_document_id,
        projectId: document.project_id,
        status: 'draft',
        title: document.title,
      });
    }

    const descendantIds = collectDescendantIds(workspace.documents, document.id);
    const idsToArchive = [document.id, ...descendantIds];

    try {
      if (hasRealSession) {
        await archiveMutation.mutateAsync(idsToArchive);
      } else {
        setLocalWorkspace((current) => archiveLocalDocument(current, idsToArchive));
      }
      navigate('/app/documentos?home=1');
      toast.success(
        idsToArchive.length > 1
          ? 'Pagina e subpaginas arquivadas.'
          : 'Pagina arquivada.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel arquivar a pagina.');
    }
  }

  function exportDocument(document: WorkspacePageWithContext) {
    const markdown = htmlToMarkdown(document.body);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${slugify(document.title)}.md`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  const mainHeadline = getHeadline(routeMode, selectedDocument?.accountName, selectedDocument?.projectTitle);
  const mainSubheadline = getSubheadline(routeMode, contextPages.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <DocumentBreadcrumb items={breadcrumbs} />
          <p className="mt-2 text-sm text-muted-foreground">
            Documentos agora funcionam como workspace de conhecimento, com arvore lateral e editor de pagina.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(workspaceQuery.isFetching || createMutation.isPending || updateMutation.isPending || archiveMutation.isPending) ? (
            <Badge tone="warning">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Atualizando
            </Badge>
          ) : null}
          <Badge tone={hasRealSession ? 'success' : 'neutral'}>{hasRealSession ? 'Supabase' : 'Local'}</Badge>
          <Button type="button" onClick={() => void handleCreatePage()}>
            <Plus size={16} />
            Nova pagina
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="grid min-h-[calc(100vh-12rem)] xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-card xl:border-b-0 xl:border-r">
            <div className="space-y-5 p-4">
              <div className="flex gap-2">
                <Button className="flex-1" type="button" onClick={() => void handleCreatePage()}>
                  <Plus size={16} />
                  Nova pagina
                </Button>
                <Button className="px-3" type="button" variant="secondary" onClick={() => navigate('/app/documentos?home=1')}>
                  Workspace
                </Button>
              </div>

              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  className="pl-9"
                  placeholder="Buscar paginas"
                  value={sidebarSearch}
                  onChange={(event) => setSidebarSearch(event.target.value)}
                />
              </label>

              <nav className="space-y-1 text-sm">
                <SidebarLink icon={<Clock3 size={15} />} label="Recentes" to="/app/documentos/recentes" count={recentPages.length} />
                <SidebarLink icon={<Star size={15} />} label="Favoritos" to="/app/documentos/favoritos" count={favoritePages.length} />
                <SidebarLink icon={<UsersRound size={15} />} label="Todas as paginas" to="/app/documentos?home=1" count={activePages.length} />
                <SidebarLink icon={<FolderArchive size={15} />} label="Arquivadas" to="/app/documentos/arquivados" count={archivedPages.length} />
              </nav>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Arvore de paginas
                  </h2>
                  <Badge tone="neutral">{filteredSidebarPages.length}</Badge>
                </div>
                {tree.length > 0 ? (
                  <PageTree
                    activeDocumentId={selectedDocument?.id ?? null}
                    favoriteIds={favoriteIds}
                    nodes={tree}
                    onCreateSubpage={(parentId) => void handleCreatePage(undefined, parentId)}
                    onOpen={openDocument}
                    onToggleFavorite={(pageId) => {
                      const document = workspace.documents.find((item) => item.id === pageId);
                      if (document) void handleToggleFavorite(document);
                    }}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Nenhuma pagina apareceu nesse recorte ainda.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Atalhos por cliente
                </h2>
                <div className="space-y-1">
                  {groupedByAccount.slice(0, 6).map((group) => (
                    <Link
                      key={group.label}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-muted"
                      to={`/app/documentos/cliente/${group.items[0]?.account_id ?? ''}`}
                    >
                      <span className="truncate">{group.label}</span>
                      <span className="text-xs text-muted-foreground">{group.items.length}</span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Atalhos por projeto
                </h2>
                <div className="space-y-1">
                  {groupedByProject.slice(0, 6).map((group) => (
                    <Link
                      key={group.label}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-muted"
                      to={`/app/documentos/projeto/${group.items[0]?.project_id ?? ''}`}
                    >
                      <span className="truncate">{group.label}</span>
                      <span className="text-xs text-muted-foreground">{group.items.length}</span>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </aside>

          <div className="min-w-0 bg-background">
            {workspaceQuery.isError ? (
              <div className="p-8">
                <EmptyState
                  icon={<FileText size={20} />}
                  title="Nao foi possivel carregar o workspace"
                  description={workspaceQuery.error.message}
                />
              </div>
            ) : selectedDocument ? (
              <DocumentEditor
                accounts={workspace.accounts}
                allPages={workspace.documents}
                canManageAttachments={!hasRealSession}
                document={selectedDocument}
                isSaving={isSaving}
                onAddSubpage={() => void handleCreatePage(undefined, selectedDocument.id)}
                onDuplicate={() => void handleDuplicateDocument(selectedDocument)}
                onExportMarkdown={() => exportDocument(selectedDocument)}
                projects={workspace.projects}
                onSave={(payload) => void handleSaveDocument(selectedDocument, payload)}
                onToggleArchive={() => void handleToggleArchive(selectedDocument)}
                onToggleFavorite={() => void handleToggleFavorite(selectedDocument)}
              />
            ) : (
              <DocumentHome
                favorites={favoritePages}
                groupedByAccount={groupedByAccount}
                groupedByProject={groupedByProject}
                headline={mainHeadline}
                pages={contextPages}
                recent={recentPages}
                subheadline={mainSubheadline}
                templates={documentTemplates.map((template) => ({
                  label: template.label,
                  onClick: () => void handleCreatePage(template),
                }))}
                onCreatePage={() => void handleCreatePage()}
                onOpenPage={openDocument}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SidebarLink({
  count,
  icon,
  label,
  to,
}: {
  count: number;
  icon: React.ReactNode;
  label: string;
  to: string;
}) {
  return (
    <Link
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition hover:bg-muted"
      to={to}
    >
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span>{label}</span>
      </span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </Link>
  );
}

function readRemoteUiState(): DocumentsRemoteUiState {
  if (typeof window === 'undefined') {
    return { lastOpenedDocumentId: null, recentDocumentIds: [] };
  }

  try {
    const raw = window.localStorage.getItem(remoteUiStorageKey);
    if (!raw) return { lastOpenedDocumentId: null, recentDocumentIds: [] };
    const parsed = JSON.parse(raw) as Partial<DocumentsRemoteUiState>;
    return {
      lastOpenedDocumentId:
        typeof parsed.lastOpenedDocumentId === 'string' ? parsed.lastOpenedDocumentId : null,
      recentDocumentIds: Array.isArray(parsed.recentDocumentIds) ? parsed.recentDocumentIds : [],
    };
  } catch {
    return { lastOpenedDocumentId: null, recentDocumentIds: [] };
  }
}

function getRecentPages(pages: WorkspacePageWithContext[], recentIds: string[]) {
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const explicitRecent = recentIds
    .map((id) => pageById.get(id) ?? null)
    .filter((page): page is WorkspacePageWithContext => Boolean(page));

  const fallback = pages
    .filter((page) => page.last_opened_at)
    .sort((first, second) => {
      const firstTime = first.last_opened_at ? new Date(first.last_opened_at).getTime() : 0;
      const secondTime = second.last_opened_at ? new Date(second.last_opened_at).getTime() : 0;
      return secondTime - firstTime;
    });

  const seen = new Set<string>();
  return [...explicitRecent, ...fallback].filter((page) => {
    if (seen.has(page.id)) return false;
    seen.add(page.id);
    return true;
  });
}

function getHeadline(
  mode: 'arquivados' | 'cliente' | 'favoritos' | 'home' | 'pagina' | 'projeto' | 'recentes',
  accountName?: string | null,
  projectTitle?: string | null,
) {
  switch (mode) {
    case 'favoritos':
      return 'Paginas favoritas';
    case 'recentes':
      return 'Paginas recentes';
    case 'arquivados':
      return 'Arquivo do workspace';
    case 'cliente':
      return accountName ? `Paginas de ${accountName}` : 'Paginas por cliente';
    case 'projeto':
      return projectTitle ? `Paginas de ${projectTitle}` : 'Paginas por projeto';
    default:
      return 'Workspace de documentos';
  }
}

function getSubheadline(
  mode: 'arquivados' | 'cliente' | 'favoritos' | 'home' | 'pagina' | 'projeto' | 'recentes',
  count: number,
) {
  switch (mode) {
    case 'favoritos':
      return `${count} paginas fixadas para acesso rapido da equipe.`;
    case 'recentes':
      return `${count} paginas abertas por ultimo, ideais para retomar contexto rapido.`;
    case 'arquivados':
      return `${count} paginas que sairam da rotina ativa, mas continuam consultaveis.`;
    case 'cliente':
      return `${count} paginas relacionadas ao cliente filtrado pela rota atual.`;
    case 'projeto':
      return `${count} paginas relacionadas ao projeto filtrado pela rota atual.`;
    default:
      return 'Uma area de conhecimento com navegacao lateral, favoritos, recentes e editor rico estilo wiki.';
  }
}

function htmlToMarkdown(html: string) {
  return html
    .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
    .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
    .replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n')
    .replace(/<li>(.*?)<\/li>/g, '- $1\n')
    .replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n\n')
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}
