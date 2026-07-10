import { initialCommercialLeads } from '@/features/opportunities/commercial-data';
import { loadLocalProjectWorkspace } from '@/features/projects/projects-data';
import type { Account, DocumentRecentView, Project } from '@/types/database';

import {
  normalizeWorkspacePage,
  type DocumentAttachment,
  type WorkspacePage,
  type WorkspacePageWithContext,
} from './documents-workspace';

export type DocumentAccountOption = Pick<Account, 'id' | 'display_name'>;
export type DocumentProjectOption = Pick<Project, 'account_id' | 'id' | 'status' | 'title'>;

type LocalDocumentStore = {
  documents: WorkspacePage[];
  favorite_ids: string[];
  last_opened_document_id: string | null;
  recent_views: DocumentRecentView[];
};

export type LocalDocumentWorkspace = {
  accounts: DocumentAccountOption[];
  documents: WorkspacePageWithContext[];
  favoriteIds: string[];
  lastOpenedDocumentId: string | null;
  projects: DocumentProjectOption[];
  recentViews: DocumentRecentView[];
};

const LOCAL_STORAGE_KEY = 'arrobaco.documents.workspace.v2';
const organizationId = 'org-arroba-local';
const ownerId = 'local-richards';

function nowIso() {
  return new Date().toISOString();
}

function seedAccounts(): DocumentAccountOption[] {
  return initialCommercialLeads
    .filter((lead) => lead.account.lifecycle_status === 'client')
    .map((lead) => ({
      id: lead.account.id,
      display_name: lead.account.display_name,
    }));
}

function seedProjects(): DocumentProjectOption[] {
  return loadLocalProjectWorkspace().projects.map((project) => ({
    id: project.id,
    account_id: project.account_id,
    title: project.title,
    status: project.status,
  }));
}

function makeVersion(title: string, body: string) {
  return {
    body,
    id: crypto.randomUUID(),
    saved_at: nowIso(),
    title,
  };
}

function buildSeedDocuments(): WorkspacePage[] {
  const createdAt = nowIso();

  return [
    normalizeWorkspacePage({
      id: 'doc-root-kianda',
      organization_id: organizationId,
      account_id: 'account-kianda',
      project_id: null,
      parent_document_id: null,
      title: 'Kianda Calcados',
      doc_type: 'note',
      status: 'approved',
      body: '<h1>Kianda Calcados</h1><p>Espaco central de conhecimento do cliente.</p>',
      icon: 'Store',
      is_pinned: true,
      position: 0,
      last_opened_at: createdAt,
      updated_by: ownerId,
      created_at: createdAt,
      updated_at: createdAt,
      attachments: [],
      versions: [makeVersion('Kianda Calcados', '<h1>Kianda Calcados</h1><p>Espaco central de conhecimento do cliente.</p>')],
    }),
    normalizeWorkspacePage({
      id: 'doc-kianda-briefing',
      organization_id: organizationId,
      account_id: 'account-kianda',
      project_id: 'project-kianda-onboarding',
      parent_document_id: 'doc-root-kianda',
      title: 'Briefing inicial',
      doc_type: 'briefing',
      status: 'approved',
      body:
        '<h1>Briefing inicial</h1><p>Objetivo: alinhar calendario de conteudo, tom de voz e rotina de captacao.</p><ul><li>Foco em vitrine e prova social</li><li>3 dias de gravacao por quinzena</li><li>Responsavel de aprovacao: Marina</li></ul>',
      icon: 'FileText',
      position: 1,
      updated_by: ownerId,
      created_at: createdAt,
      updated_at: createdAt,
      attachments: [],
      versions: [
        makeVersion(
          'Briefing inicial',
          '<h1>Briefing inicial</h1><p>Objetivo: alinhar calendario de conteudo, tom de voz e rotina de captacao.</p><ul><li>Foco em vitrine e prova social</li><li>3 dias de gravacao por quinzena</li><li>Responsavel de aprovacao: Marina</li></ul>',
        ),
      ],
    }),
    normalizeWorkspacePage({
      id: 'doc-kianda-calendario',
      organization_id: organizationId,
      account_id: 'account-kianda',
      project_id: 'project-kianda-onboarding',
      parent_document_id: 'doc-root-kianda',
      title: 'Calendario editorial',
      doc_type: 'note',
      status: 'in_review',
      body:
        '<h1>Calendario editorial</h1><h2>Julho 2026</h2><ul><li>Reels de vitrine</li><li>Stories de prova social</li></ul>',
      icon: 'CalendarDays',
      position: 2,
      updated_by: ownerId,
      created_at: createdAt,
      updated_at: createdAt,
      attachments: [],
      versions: [
        makeVersion(
          'Calendario editorial',
          '<h1>Calendario editorial</h1><h2>Julho 2026</h2><ul><li>Reels de vitrine</li><li>Stories de prova social</li></ul>',
        ),
      ],
    }),
    normalizeWorkspacePage({
      id: 'doc-kianda-julho',
      organization_id: organizationId,
      account_id: 'account-kianda',
      project_id: 'project-kianda-onboarding',
      parent_document_id: 'doc-kianda-calendario',
      title: 'Julho 2026',
      doc_type: 'report',
      status: 'draft',
      body: '<h1>Julho 2026</h1><p>Planejamento de conteudo do mes.</p>',
      icon: 'FolderKanban',
      position: 0,
      updated_by: ownerId,
      created_at: createdAt,
      updated_at: createdAt,
      attachments: [],
      versions: [makeVersion('Julho 2026', '<h1>Julho 2026</h1><p>Planejamento de conteudo do mes.</p>')],
    }),
    normalizeWorkspacePage({
      id: 'doc-kianda-roteiro',
      organization_id: organizationId,
      account_id: 'account-kianda',
      project_id: 'project-kianda-onboarding',
      parent_document_id: 'doc-root-kianda',
      title: 'Roteiro de captacao',
      doc_type: 'script',
      status: 'draft',
      body:
        '<h1>Roteiro de captacao</h1><blockquote>Bastidores, vitrine e CTA para direct.</blockquote><ul><li>Abertura com loja</li><li>Close dos looks</li><li>Convite para visita presencial</li></ul>',
      icon: 'Clapperboard',
      position: 3,
      updated_by: ownerId,
      created_at: createdAt,
      updated_at: createdAt,
      attachments: [],
      versions: [
        makeVersion(
          'Roteiro de captacao',
          '<h1>Roteiro de captacao</h1><blockquote>Bastidores, vitrine e CTA para direct.</blockquote><ul><li>Abertura com loja</li><li>Close dos looks</li><li>Convite para visita presencial</li></ul>',
        ),
      ],
    }),
  ];
}

function persistStore(store: LocalDocumentStore) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
}

function buildWorkspaceFromStore(store: LocalDocumentStore): LocalDocumentWorkspace {
  const accounts = seedAccounts();
  const projects = seedProjects();
  const accountById = new Map(accounts.map((account) => [account.id, account.display_name]));
  const projectById = new Map(projects.map((project) => [project.id, project.title]));

  return {
    accounts,
    documents: store.documents.map((document) =>
      normalizeWorkspacePage({
        ...document,
        accountName: document.account_id ? (accountById.get(document.account_id) ?? null) : null,
        projectTitle: document.project_id ? (projectById.get(document.project_id) ?? null) : null,
      }),
    ),
    favoriteIds: store.favorite_ids,
    lastOpenedDocumentId: store.last_opened_document_id,
    projects,
    recentViews: store.recent_views,
  };
}

function createSeedStore(): LocalDocumentStore {
  return {
    documents: buildSeedDocuments(),
    favorite_ids: ['doc-root-kianda', 'doc-kianda-briefing'],
    last_opened_document_id: 'doc-kianda-briefing',
    recent_views: [
      {
        document_id: 'doc-kianda-briefing',
        user_id: ownerId,
        viewed_at: nowIso(),
      },
    ],
  };
}

export function loadLocalDocumentWorkspace(): LocalDocumentWorkspace {
  if (typeof window === 'undefined') {
    return buildWorkspaceFromStore(createSeedStore());
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) {
    const seedStore = createSeedStore();
    persistStore(seedStore);
    return buildWorkspaceFromStore(seedStore);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalDocumentStore>;
    const store = {
      documents: Array.isArray(parsed.documents)
        ? parsed.documents.map((document) => normalizeWorkspacePage(document))
        : buildSeedDocuments(),
      favorite_ids: Array.isArray(parsed.favorite_ids) ? parsed.favorite_ids : [],
      last_opened_document_id:
        typeof parsed.last_opened_document_id === 'string' ? parsed.last_opened_document_id : null,
      recent_views: Array.isArray(parsed.recent_views) ? parsed.recent_views : [],
    };
    persistStore(store);
    return buildWorkspaceFromStore(store);
  } catch {
    const seedStore = createSeedStore();
    persistStore(seedStore);
    return buildWorkspaceFromStore(seedStore);
  }
}

export type CreateLocalDocumentInput = {
  accountId: string | null;
  body: string;
  docType: WorkspacePage['doc_type'];
  icon?: string | null;
  parentDocumentId?: string | null;
  projectId: string | null;
  status: WorkspacePage['status'];
  title: string;
};

export type UpdateLocalDocumentInput = {
  accountId: string | null;
  attachments?: DocumentAttachment[];
  body: string;
  docId: string;
  docType: WorkspacePage['doc_type'];
  icon?: string | null;
  isPinned?: boolean;
  parentDocumentId?: string | null;
  projectId: string | null;
  status: WorkspacePage['status'];
  title: string;
};

function saveWorkspaceDocuments(
  workspace: LocalDocumentWorkspace,
  documents: WorkspacePage[],
  overrides?: Partial<Pick<LocalDocumentStore, 'favorite_ids' | 'last_opened_document_id' | 'recent_views'>>,
) {
  const store: LocalDocumentStore = {
    documents,
    favorite_ids: overrides?.favorite_ids ?? workspace.favoriteIds,
    last_opened_document_id: overrides?.last_opened_document_id ?? workspace.lastOpenedDocumentId,
    recent_views: overrides?.recent_views ?? workspace.recentViews,
  };
  persistStore(store);
  return buildWorkspaceFromStore(store);
}

export function createLocalDocument(
  workspace: LocalDocumentWorkspace,
  values: CreateLocalDocumentInput,
): LocalDocumentWorkspace {
  const timestamp = nowIso();
  const siblingCount = workspace.documents.filter(
    (document) => (document.parent_document_id ?? null) === (values.parentDocumentId ?? null),
  ).length;

  const nextDocument = normalizeWorkspacePage({
    account_id: values.accountId,
    attachments: [],
    body: values.body,
    created_at: timestamp,
    doc_type: values.docType,
    icon: values.icon ?? 'FileText',
    id: crypto.randomUUID(),
    is_pinned: false,
    last_opened_at: timestamp,
    organization_id: organizationId,
    parent_document_id: values.parentDocumentId ?? null,
    position: siblingCount,
    project_id: values.projectId,
    status: values.status,
    title: values.title,
    updated_at: timestamp,
    updated_by: ownerId,
    versions: [makeVersion(values.title, values.body)],
  });

  return saveWorkspaceDocuments(workspace, [nextDocument, ...workspace.documents], {
    last_opened_document_id: nextDocument.id,
    recent_views: [
      {
        document_id: nextDocument.id,
        user_id: ownerId,
        viewed_at: timestamp,
      },
      ...workspace.recentViews.filter((view) => view.document_id !== nextDocument.id),
    ].slice(0, 20),
  });
}

export function updateLocalDocument(
  workspace: LocalDocumentWorkspace,
  values: UpdateLocalDocumentInput,
): LocalDocumentWorkspace {
  const timestamp = nowIso();
  const nextDocuments = workspace.documents.map((document) => {
    if (document.id !== values.docId) return document;

    const shouldCreateVersion = document.title !== values.title || document.body !== values.body;
    return normalizeWorkspacePage({
      ...document,
      account_id: values.accountId,
      attachments: values.attachments ?? document.attachments,
      body: values.body,
      doc_type: values.docType,
      icon: values.icon ?? document.icon,
      is_pinned: values.isPinned ?? document.is_pinned,
      last_opened_at: timestamp,
      parent_document_id: values.parentDocumentId ?? document.parent_document_id,
      project_id: values.projectId,
      status: values.status,
      title: values.title,
      updated_at: timestamp,
      updated_by: ownerId,
      versions: shouldCreateVersion
        ? [
            makeVersion(values.title, values.body),
            ...document.versions,
          ].slice(0, 20)
        : document.versions,
    });
  });

  return saveWorkspaceDocuments(workspace, nextDocuments, {
    last_opened_document_id: values.docId,
    recent_views: [
      {
        document_id: values.docId,
        user_id: ownerId,
        viewed_at: timestamp,
      },
      ...workspace.recentViews.filter((view) => view.document_id !== values.docId),
    ].slice(0, 20),
  });
}

export function toggleLocalDocumentFavorite(
  workspace: LocalDocumentWorkspace,
  documentId: string,
): LocalDocumentWorkspace {
  const favoriteIds = workspace.favoriteIds.includes(documentId)
    ? workspace.favoriteIds.filter((item) => item !== documentId)
    : [documentId, ...workspace.favoriteIds];

  return saveWorkspaceDocuments(
    workspace,
    workspace.documents.map((document) =>
      document.id === documentId ? { ...document, is_pinned: favoriteIds.includes(documentId) } : document,
    ),
    { favorite_ids: favoriteIds },
  );
}

export function duplicateLocalDocument(
  workspace: LocalDocumentWorkspace,
  documentId: string,
): LocalDocumentWorkspace {
  const document = workspace.documents.find((item) => item.id === documentId);
  if (!document) return workspace;

  return createLocalDocument(workspace, {
    accountId: document.account_id,
    body: document.body,
    docType: document.doc_type,
    icon: document.icon,
    parentDocumentId: document.parent_document_id,
    projectId: document.project_id,
    status: 'draft',
    title: `${document.title} (copia)`,
  });
}

export function archiveLocalDocument(
  workspace: LocalDocumentWorkspace,
  documentIds: string[],
): LocalDocumentWorkspace {
  const timestamp = nowIso();
  const ids = new Set(documentIds);

  return saveWorkspaceDocuments(
    workspace,
    workspace.documents.map((document) =>
      ids.has(document.id)
        ? {
            ...document,
            status: 'archived',
            updated_at: timestamp,
          }
        : document,
    ),
  );
}

export function attachLocalFilesToDocument(
  workspace: LocalDocumentWorkspace,
  documentId: string,
  attachments: DocumentAttachment[],
): LocalDocumentWorkspace {
  const document = workspace.documents.find((item) => item.id === documentId);
  if (!document) return workspace;

  return updateLocalDocument(workspace, {
    accountId: document.account_id,
    attachments: [...document.attachments, ...attachments],
    body: document.body,
    docId: document.id,
    docType: document.doc_type,
    icon: document.icon,
    isPinned: document.is_pinned,
    parentDocumentId: document.parent_document_id,
    projectId: document.project_id,
    status: document.status,
    title: document.title,
  });
}
