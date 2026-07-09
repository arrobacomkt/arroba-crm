import { initialCommercialLeads } from '@/features/opportunities/commercial-data';
import { loadLocalProjectWorkspace } from '@/features/projects/projects-data';
import type { Account, Project, WorkspaceDocument } from '@/types/database';

export type DocumentAccountOption = Pick<Account, 'id' | 'display_name'>;
export type DocumentProjectOption = Pick<Project, 'account_id' | 'id' | 'status' | 'title'>;

type LocalDocumentStore = {
  documents: WorkspaceDocument[];
};

export type LocalDocumentWorkspace = {
  accounts: DocumentAccountOption[];
  documents: WorkspaceDocument[];
  projects: DocumentProjectOption[];
};

const LOCAL_STORAGE_KEY = 'arrobaco.localDocumentsWorkspace';
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

function buildSeedDocuments(): WorkspaceDocument[] {
  const createdAt = nowIso();

  return [
    {
      id: 'doc-kianda-briefing',
      organization_id: organizationId,
      account_id: 'account-kianda',
      project_id: 'project-kianda-onboarding',
      title: 'Briefing inicial Kianda',
      doc_type: 'briefing',
      status: 'approved',
      body: 'Objetivo: alinhar calendario de conteudo, tom de voz e rotina de captacao.\n\nPontos principais:\n- foco em vitrine e prova social\n- 3 dias de gravacao por quinzena\n- responsavel de aprovacao: Marina\n- prioridade inicial: reels e ofertas semanais',
      updated_by: ownerId,
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: 'doc-kianda-roteiro',
      organization_id: organizationId,
      account_id: 'account-kianda',
      project_id: 'project-kianda-onboarding',
      title: 'Roteiro de captacao - primeira visita',
      doc_type: 'script',
      status: 'draft',
      body: 'Abertura:\n- boas-vindas e bastidores da loja\n\nBlocos:\n- destaque da vitrine\n- selecao de looks\n- depoimento rapido da equipe\n\nFechamento:\n- CTA para direct e visita presencial',
      updated_by: ownerId,
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];
}

function persistStore(store: LocalDocumentStore) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
}

function buildWorkspaceFromStore(store: LocalDocumentStore): LocalDocumentWorkspace {
  return {
    accounts: seedAccounts(),
    projects: seedProjects(),
    documents: store.documents,
  };
}

export function loadLocalDocumentWorkspace(): LocalDocumentWorkspace {
  if (typeof window === 'undefined') {
    return buildWorkspaceFromStore({ documents: buildSeedDocuments() });
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) {
    const seedStore = { documents: buildSeedDocuments() };
    persistStore(seedStore);
    return buildWorkspaceFromStore(seedStore);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalDocumentStore>;
    const documents = Array.isArray(parsed.documents) ? parsed.documents : buildSeedDocuments();
    const store = { documents };
    persistStore(store);
    return buildWorkspaceFromStore(store);
  } catch {
    const seedStore = { documents: buildSeedDocuments() };
    persistStore(seedStore);
    return buildWorkspaceFromStore(seedStore);
  }
}

export type CreateLocalDocumentInput = {
  accountId: string | null;
  body: string;
  docType: WorkspaceDocument['doc_type'];
  projectId: string | null;
  status: WorkspaceDocument['status'];
  title: string;
};

export function createLocalDocument(
  workspace: LocalDocumentWorkspace,
  values: CreateLocalDocumentInput,
): LocalDocumentWorkspace {
  const timestamp = nowIso();
  const nextDocument: WorkspaceDocument = {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    account_id: values.accountId,
    project_id: values.projectId,
    title: values.title,
    doc_type: values.docType,
    status: values.status,
    body: values.body,
    updated_by: ownerId,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const nextStore = {
    documents: [nextDocument, ...workspace.documents],
  };
  persistStore(nextStore);
  return buildWorkspaceFromStore(nextStore);
}

export type UpdateLocalDocumentInput = {
  accountId: string | null;
  body: string;
  docId: string;
  docType: WorkspaceDocument['doc_type'];
  projectId: string | null;
  status: WorkspaceDocument['status'];
  title: string;
};

export function updateLocalDocument(
  workspace: LocalDocumentWorkspace,
  values: UpdateLocalDocumentInput,
): LocalDocumentWorkspace {
  const timestamp = nowIso();
  const nextStore = {
    documents: workspace.documents.map((document) =>
      document.id === values.docId
        ? {
            ...document,
            account_id: values.accountId,
            project_id: values.projectId,
            title: values.title,
            doc_type: values.docType,
            status: values.status,
            body: values.body,
            updated_at: timestamp,
            updated_by: ownerId,
          }
        : document,
    ),
  };

  persistStore(nextStore);
  return buildWorkspaceFromStore(nextStore);
}
