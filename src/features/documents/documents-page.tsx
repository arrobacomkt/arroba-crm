import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileText,
  Filter,
  FolderArchive,
  Loader2,
  Plus,
  Save,
  Search,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import type { WorkspaceDocument } from '@/types/database';

import {
  documentStatusLabels,
  documentStatusOptions,
  documentStatusTone,
  documentTypeLabels,
  documentTypeOptions,
} from './documents-constants';
import {
  createLocalDocument,
  loadLocalDocumentWorkspace,
  updateLocalDocument,
} from './documents-data';
import {
  createDocument,
  documentsWorkspaceQueryKey,
  fetchDocumentsWorkspace,
  updateDocument,
  type DocumentsWorkspace,
  type DocumentWorkspaceDocument,
} from './documents-queries';

type EditorState = {
  accountId: string;
  body: string;
  docType: WorkspaceDocument['doc_type'];
  projectId: string;
  status: WorkspaceDocument['status'];
  title: string;
};

type SortMode = 'updated_desc' | 'updated_asc' | 'title_asc';

const documentTemplates: Array<{
  docType: WorkspaceDocument['doc_type'];
  label: string;
  title: string;
  body: string;
}> = [
  {
    docType: 'briefing',
    label: 'Briefing',
    title: 'Novo briefing',
    body:
      'Objetivo:\n- \n\nEscopo:\n- \n\nPublico:\n- \n\nReferencias:\n- \n\nObservacoes:\n- ',
  },
  {
    docType: 'script',
    label: 'Roteiro',
    title: 'Novo roteiro',
    body:
      'Abertura:\n- \n\nBlocos principais:\n- \n- \n- \n\nEncerramento:\n- \n\nCTA:\n- ',
  },
  {
    docType: 'report',
    label: 'Relatorio',
    title: 'Novo relatorio',
    body:
      'Resumo executivo:\n- \n\nO que foi entregue:\n- \n\nResultados:\n- \n\nPontos de atencao:\n- \n\nProximos passos:\n- ',
  },
  {
    docType: 'note',
    label: 'Nota interna',
    title: 'Nova nota interna',
    body: 'Contexto:\n- \n\nDecisoes:\n- \n\nPendencias:\n- \n\nResponsaveis:\n- ',
  },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildEditorState(
  document: Pick<
    WorkspaceDocument,
    'account_id' | 'body' | 'doc_type' | 'project_id' | 'status' | 'title'
  > | null,
): EditorState {
  return {
    title: document?.title ?? '',
    body: document?.body ?? '',
    docType: document?.doc_type ?? 'briefing',
    status: document?.status ?? 'draft',
    accountId: document?.account_id ?? '',
    projectId: document?.project_id ?? '',
  };
}

function snapshotFromEditor(documentId: string, editor: EditorState) {
  return JSON.stringify({
    documentId,
    title: editor.title,
    body: editor.body,
    docType: editor.docType,
    status: editor.status,
    accountId: editor.accountId || null,
    projectId: editor.projectId || null,
  });
}

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function estimateReadMinutes(wordCount: number) {
  return Math.max(1, Math.ceil(wordCount / 180));
}

export function DocumentsPage() {
  const { isSupabaseConfigured, user } = useAuth();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: documentsWorkspaceQueryKey,
    queryFn: fetchDocumentsWorkspace,
    enabled: hasRealSession,
  });

  const [localWorkspace, setLocalWorkspace] = useState(() => loadLocalDocumentWorkspace());
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkspaceDocument['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | WorkspaceDocument['doc_type']>('all');
  const [sortMode, setSortMode] = useState<SortMode>('updated_desc');
  const [editor, setEditor] = useState<EditorState>(() => buildEditorState(null));
  const [editorDocumentId, setEditorDocumentId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const localWorkspaceView = useMemo<DocumentsWorkspace>(() => {
    const accountById = new Map(
      localWorkspace.accounts.map((account) => [account.id, account.display_name]),
    );
    const projectById = new Map(
      localWorkspace.projects.map((project) => [project.id, project.title]),
    );

    return {
      accounts: localWorkspace.accounts,
      projects: localWorkspace.projects,
      documents: localWorkspace.documents.map((document) => ({
        ...document,
        accountName: document.account_id ? (accountById.get(document.account_id) ?? null) : null,
        projectTitle: document.project_id ? (projectById.get(document.project_id) ?? null) : null,
      })),
    };
  }, [localWorkspace]);

  const workspace = hasRealSession
    ? (workspaceQuery.data ?? { accounts: [], projects: [], documents: [] })
    : localWorkspaceView;

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = workspace.documents.filter((document) => {
      if (statusFilter !== 'all' && document.status !== statusFilter) return false;
      if (typeFilter !== 'all' && document.doc_type !== typeFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        document.title,
        document.accountName ?? '',
        document.projectTitle ?? '',
        document.body,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    return filtered.sort((first, second) => {
      if (sortMode === 'title_asc') {
        return first.title.localeCompare(second.title, 'pt-BR');
      }

      if (sortMode === 'updated_asc') {
        return new Date(first.updated_at).getTime() - new Date(second.updated_at).getTime();
      }

      return new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime();
    });
  }, [search, sortMode, statusFilter, typeFilter, workspace.documents]);

  const selectedDocument = useMemo(
    () =>
      workspace.documents.find((document) => document.id === selectedDocumentId) ??
      filteredDocuments[0] ??
      null,
    [filteredDocuments, selectedDocumentId, workspace.documents],
  );

  const activeEditor =
    selectedDocument && editorDocumentId !== selectedDocument.id
      ? buildEditorState(selectedDocument)
      : editor;

  const currentProjects = useMemo(() => {
    if (!activeEditor.accountId) return workspace.projects;
    return workspace.projects.filter((project) => project.account_id === activeEditor.accountId);
  }, [activeEditor.accountId, workspace.projects]);

  const documentStats = useMemo(
    () => ({
      total: workspace.documents.length,
      drafts: workspace.documents.filter((document) => document.status === 'draft').length,
      inReview: workspace.documents.filter((document) => document.status === 'in_review').length,
      approved: workspace.documents.filter((document) => document.status === 'approved').length,
      archived: workspace.documents.filter((document) => document.status === 'archived').length,
      linkedToProjects: workspace.documents.filter((document) => document.project_id).length,
    }),
    [workspace.documents],
  );
  const reviewQueue = useMemo(
    () =>
      workspace.documents
        .filter((document) => ['draft', 'in_review'].includes(document.status))
        .sort((first, second) => new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime())
        .slice(0, 4),
    [workspace.documents],
  );
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== 'all' || typeFilter !== 'all';

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsWorkspaceQueryKey });
      toast.success('Documento criado com sucesso.');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsWorkspaceQueryKey });
      setSaveState('saved');
    },
    onError: (error) => {
      toast.error(error.message);
      setSaveState('idle');
    },
  });

  const baselineSnapshot = selectedDocument
    ? snapshotFromEditor(selectedDocument.id, buildEditorState(selectedDocument))
    : null;
  const currentSnapshot = selectedDocument
    ? snapshotFromEditor(selectedDocument.id, activeEditor)
    : null;
  const hasUnsavedChanges = Boolean(selectedDocument && baselineSnapshot !== currentSnapshot);

  const editorWordCount = countWords(activeEditor.body);
  const editorReadMinutes = estimateReadMinutes(editorWordCount);

  useEffect(() => {
    if (!selectedDocument || !hasUnsavedChanges) return;

    const timer = window.setTimeout(async () => {
      setSaveState('saving');

      const payload = {
        docId: selectedDocument.id,
        title: activeEditor.title.trim() || 'Sem titulo',
        body: activeEditor.body,
        docType: activeEditor.docType,
        status: activeEditor.status,
        accountId: activeEditor.accountId || null,
        projectId: activeEditor.projectId || null,
      };

      if (hasRealSession) {
        await updateMutation.mutateAsync(payload);
        return;
      }

      setLocalWorkspace((current) => updateLocalDocument(current, payload));
      setSaveState('saved');
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeEditor, hasRealSession, hasUnsavedChanges, selectedDocument, updateMutation]);

  function activateDocument(document: DocumentWorkspaceDocument | WorkspaceDocument) {
    setSelectedDocumentId(document.id);
    setEditorDocumentId(document.id);
    setEditor(buildEditorState(document));
    setSaveState('idle');
  }

  function updateEditorState(updater: (current: EditorState) => EditorState) {
    const base =
      selectedDocument && editorDocumentId !== selectedDocument.id
        ? buildEditorState(selectedDocument)
        : editor;

    setEditorDocumentId(selectedDocument?.id ?? editorDocumentId);
    setSaveState('idle');
    setEditor(updater(base));
  }

  function handleCreateDocument(
    template?: Pick<EditorState, 'body' | 'docType' | 'status' | 'title'>,
  ) {
    const defaultAccountId = workspace.accounts[0]?.id ?? null;
    const defaultProjectId =
      workspace.projects.find((project) => project.account_id === defaultAccountId)?.id ?? null;

    const payload = {
      title: template?.title ?? 'Novo documento',
      body: template?.body ?? '',
      docType: template?.docType ?? ('briefing' as const),
      status: template?.status ?? ('draft' as const),
      accountId: defaultAccountId,
      projectId: defaultProjectId,
    };

    if (hasRealSession) {
      createMutation.mutate(payload, {
        onSuccess: (createdDocument) => {
          activateDocument(createdDocument);
        },
      });
      return;
    }

    const nextWorkspace = createLocalDocument(localWorkspace, payload);
    setLocalWorkspace(nextWorkspace);
    if (nextWorkspace.documents[0]) {
      activateDocument(nextWorkspace.documents[0]);
    }
    toast.success('Documento criado localmente.');
  }

  function handleDuplicateDocument() {
    if (!selectedDocument) return;

    handleCreateDocument({
      title: `${activeEditor.title.trim() || selectedDocument.title} (copia)`,
      body: activeEditor.body,
      docType: activeEditor.docType,
      status: 'draft',
    });
  }

  function handleToggleArchive() {
    if (!selectedDocument) return;

    updateEditorState((current) => ({
      ...current,
      status: current.status === 'archived' ? 'draft' : 'archived',
    }));
  }

  async function handleCopyContent() {
    if (!selectedDocument) return;

    const content = `${activeEditor.title.trim() || selectedDocument.title}\n\n${activeEditor.body}`.trim();

    try {
      await navigator.clipboard.writeText(content);
      toast.success('Conteudo copiado.');
    } catch {
      toast.error('Nao foi possivel copiar o conteudo.');
    }
  }

  function handleDownloadText() {
    if (!selectedDocument || typeof window === 'undefined') return;

    const title = (activeEditor.title.trim() || selectedDocument.title)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

    const content = `${activeEditor.title.trim() || selectedDocument.title}\n\n${activeEditor.body}`.trim();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${title || 'documento'}.txt`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('Download iniciado.');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Central de briefings, roteiros, relatorios e notas internas com autosave.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {workspaceQuery.isFetching || createMutation.isPending ? (
            <Badge tone="neutral">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Atualizando
            </Badge>
          ) : null}
          <Badge tone={hasRealSession ? 'success' : 'neutral'}>
            {hasRealSession ? 'Supabase' : 'Local'}
          </Badge>
          <Button onClick={() => handleCreateDocument()}>
            <Plus size={18} />
            Novo documento
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={<FileText size={20} />}
          label="Documentos"
          value={String(documentStats.total)}
        />
        <StatCard
          icon={<Clock3 size={20} />}
          label="Rascunhos"
          value={String(documentStats.drafts)}
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Aprovados"
          value={String(documentStats.approved)}
        />
        <StatCard
          icon={<Clock3 size={20} />}
          label="Em revisao"
          value={String(documentStats.inReview)}
        />
        <StatCard
          icon={<FolderArchive size={20} />}
          label="Arquivados"
          value={String(documentStats.archived)}
        />
        <StatCard
          icon={<Save size={20} />}
          label="Vinculados a projetos"
          value={String(documentStats.linkedToProjects)}
        />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Fila de revisao</h2>
              <p className="text-sm text-muted-foreground">
                Materiais que ainda pedem ajuste, aprovacao ou fechamento.
              </p>
            </div>
            <Badge tone={reviewQueue.length > 0 ? 'warning' : 'success'}>
              {reviewQueue.length} item(ns)
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {reviewQueue.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-4">
              {reviewQueue.map((document) => (
                <button
                  key={`review-${document.id}`}
                  type="button"
                  className="rounded-md border border-border p-4 text-left transition-colors hover:border-brand/40 hover:bg-muted/30"
                  onClick={() => activateDocument(document)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={documentStatusTone(document.status)}>
                      {documentStatusLabels[document.status]}
                    </Badge>
                    <Badge tone="neutral">{documentTypeLabels[document.doc_type]}</Badge>
                  </div>
                  <p className="mt-3 font-semibold">{document.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {document.accountName ?? 'Sem cliente vinculado'}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Atualizado em {formatDate(document.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nada parado na fila de revisao agora.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">Criacao rapida</h2>
              <p className="text-sm text-muted-foreground">
                Abra um documento novo ja com a estrutura certa para o contexto.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {documentTemplates.map((template) => (
                <Button
                  key={template.label}
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    handleCreateDocument({
                      title: template.title,
                      body: template.body,
                      docType: template.docType,
                      status: 'draft',
                    })
                  }
                >
                  <Plus size={16} />
                  {template.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold">Acervo</h2>
                <p className="text-sm text-muted-foreground">
                  Filtre e abra rapidamente qualquer material.
                </p>
              </div>
              <div className="grid gap-3">
                <label className="relative block">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={16}
                  />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por titulo, cliente ou conteudo"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Status
                    </span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as 'all' | WorkspaceDocument['status'])
                      }
                    >
                      <option value="all">Todos</option>
                      {documentStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {documentStatusLabels[option.value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Tipo
                    </span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      value={typeFilter}
                      onChange={(event) =>
                        setTypeFilter(event.target.value as 'all' | WorkspaceDocument['doc_type'])
                      }
                    >
                      <option value="all">Todos</option>
                      {documentTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {documentTypeLabels[option.value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Ordem
                    </span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value as SortMode)}
                    >
                      <option value="updated_desc">Mais recentes</option>
                      <option value="updated_asc">Mais antigos</option>
                      <option value="title_asc">Titulo A-Z</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {filteredDocuments.length} documento(s) exibido(s)
                  </span>
                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('all');
                        setTypeFilter('all');
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {workspaceQuery.isError ? (
              <p className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
                {workspaceQuery.error.message}
              </p>
            ) : filteredDocuments.length > 0 ? (
              <div className="space-y-3">
                {filteredDocuments.map((document) => (
                  <article
                    key={document.id}
                    className={[
                      'cursor-pointer rounded-md border p-4 transition-colors',
                      selectedDocument?.id === document.id
                        ? 'border-brand bg-brand/5'
                        : document.status === 'archived'
                          ? 'border-border bg-muted/20 hover:border-brand/30'
                        : 'border-border hover:border-brand/40 hover:bg-muted/30',
                    ].join(' ')}
                    onClick={() => activateDocument(document)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-semibold">{document.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {document.accountName ?? 'Sem cliente vinculado'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={documentStatusTone(document.status)}>
                          {documentStatusLabels[document.status]}
                        </Badge>
                        <Badge tone="neutral">{documentTypeLabels[document.doc_type]}</Badge>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {document.body || 'Sem conteudo ainda.'}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{document.projectTitle ?? 'Sem projeto vinculado'}</span>
                      <span>{formatDate(document.updated_at)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Filter size={22} />}
                title="Nenhum documento encontrado"
                description="Crie um documento novo ou ajuste os filtros para ampliar a busca."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold">Editor</h2>
                  <p className="text-sm text-muted-foreground">
                    O conteudo e salvo automaticamente enquanto voce escreve.
                  </p>
                </div>
                {selectedDocument ? (
                  <Badge
                    tone={
                      saveState === 'saved'
                        ? 'success'
                        : saveState === 'saving'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {saveState === 'saved'
                      ? 'Salvo'
                      : saveState === 'saving'
                        ? 'Salvando...'
                        : 'Sem alteracoes'}
                  </Badge>
                ) : null}
              </div>

              {selectedDocument ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={handleDuplicateDocument}>
                    <Copy size={16} />
                    Duplicar
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleCopyContent}>
                    <Copy size={16} />
                    Copiar texto
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleDownloadText}>
                    <Download size={16} />
                    Baixar .txt
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleToggleArchive}>
                    {activeEditor.status === 'archived' ? 'Reabrir documento' : 'Arquivar documento'}
                  </Button>
                  <Badge tone="neutral">{editorWordCount} palavras</Badge>
                  <Badge tone="neutral">{editorReadMinutes} min de leitura</Badge>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {selectedDocument ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Titulo</span>
                  <Input
                    value={activeEditor.title}
                    onChange={(event) =>
                      updateEditorState((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Tipo</span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      value={activeEditor.docType}
                      onChange={(event) =>
                        updateEditorState((current) => ({
                          ...current,
                          docType: event.target.value as WorkspaceDocument['doc_type'],
                        }))
                      }
                    >
                      {documentTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {documentTypeLabels[option.value]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Status</span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      value={activeEditor.status}
                      onChange={(event) =>
                        updateEditorState((current) => ({
                          ...current,
                          status: event.target.value as WorkspaceDocument['status'],
                        }))
                      }
                    >
                      {documentStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {documentStatusLabels[option.value]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Cliente</span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      value={activeEditor.accountId}
                      onChange={(event) =>
                        updateEditorState((current) => ({
                          ...current,
                          accountId: event.target.value,
                          projectId:
                            workspace.projects.find(
                              (project) => project.account_id === event.target.value,
                            )?.id ?? '',
                        }))
                      }
                    >
                      <option value="">Sem cliente</option>
                      {workspace.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.display_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Projeto</span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      value={activeEditor.projectId}
                      onChange={(event) =>
                        updateEditorState((current) => ({
                          ...current,
                          projectId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Sem projeto</option>
                      {currentProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Ultima atualizacao
                    </p>
                    <p className="mt-1 text-sm">{formatDate(selectedDocument.updated_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente</p>
                    <p className="mt-1 text-sm">{selectedDocument.accountName ?? 'Sem cliente'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Projeto</p>
                    <p className="mt-1 text-sm">{selectedDocument.projectTitle ?? 'Sem projeto'}</p>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Conteudo</span>
                  <textarea
                    className="min-h-[460px] w-full rounded-md border border-border bg-card px-3 py-3 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    placeholder="Escreva aqui o briefing, roteiro, relatorio ou nota interna..."
                    value={activeEditor.body}
                    onChange={(event) =>
                      updateEditorState((current) => ({ ...current, body: event.target.value }))
                    }
                  />
                </label>
              </div>
            ) : (
              <EmptyState
                icon={<FileText size={22} />}
                title="Selecione um documento"
                description="Abra um item da lista ou crie um documento novo para comecar."
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold data-tabular">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
