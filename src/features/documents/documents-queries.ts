import { supabase } from '@/integrations/supabase/client';
import { getCurrentWorkspaceId } from '@/features/workspaces/workspace-active';

import type { DocumentAccountOption, DocumentProjectOption } from './documents-data';
import {
  normalizeWorkspacePage,
  type WorkspacePage,
  type WorkspacePageWithContext,
} from './documents-workspace';

export type DocumentsWorkspace = {
  accounts: DocumentAccountOption[];
  documents: WorkspacePageWithContext[];
  projects: DocumentProjectOption[];
};

export const documentsWorkspaceQueryKey = ['documents-workspace'] as const;

async function getCurrentOrganizationId() {
  if (!supabase) throw new Error('Supabase nao configurado.');

  return getCurrentWorkspaceId();
}

async function getCurrentUserId() {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sessao invalida.');
  return data.user.id;
}

export async function fetchDocumentsWorkspace(): Promise<DocumentsWorkspace> {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const orgId = await getCurrentOrganizationId();
  const [documentsResult, accountsResult, projectsResult] = await Promise.all([
    supabase
      .from('documents')
      .select('*')
      .eq('organization_id', orgId)
      .order('position', { ascending: true })
      .order('updated_at', { ascending: false }),
    supabase
      .from('accounts')
      .select('id, display_name')
      .eq('organization_id', orgId)
      .eq('lifecycle_status', 'client')
      .is('deleted_at', null)
      .order('display_name', { ascending: true }),
    supabase
      .from('projects')
      .select('id, account_id, title, status')
      .eq('organization_id', orgId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false }),
  ]);

  if (documentsResult.error) throw documentsResult.error;
  if (accountsResult.error) throw accountsResult.error;
  if (projectsResult.error) throw projectsResult.error;

  const accounts = (accountsResult.data ?? []) as DocumentAccountOption[];
  const projects = (projectsResult.data ?? []) as DocumentProjectOption[];
  const accountById = new Map(accounts.map((account) => [account.id, account.display_name]));
  const projectById = new Map(projects.map((project) => [project.id, project.title]));

  return {
    accounts,
    projects,
    documents: ((documentsResult.data ?? []) as WorkspacePage[]).map((document) =>
      normalizeWorkspacePage({
        ...document,
        accountName: document.account_id ? (accountById.get(document.account_id) ?? null) : null,
        projectTitle: document.project_id ? (projectById.get(document.project_id) ?? null) : null,
      }),
    ),
  };
}

export type CreateDocumentInput = {
  accountId: string | null;
  body: string;
  docType: WorkspacePage['doc_type'];
  icon?: string | null;
  isPinned?: boolean;
  parentDocumentId?: string | null;
  position?: number;
  projectId: string | null;
  status: WorkspacePage['status'];
  title: string;
};

export async function createDocument(values: CreateDocumentInput) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const [organizationId, userId] = await Promise.all([
    getCurrentOrganizationId(),
    getCurrentUserId(),
  ]);

  const { data, error } = await supabase
    .from('documents')
    .insert({
      organization_id: organizationId,
      account_id: values.accountId,
      body: values.body,
      doc_type: values.docType,
      icon: values.icon ?? null,
      is_pinned: values.isPinned ?? false,
      last_opened_at: new Date().toISOString(),
      parent_document_id: values.parentDocumentId ?? null,
      position: values.position ?? 0,
      project_id: values.projectId,
      status: values.status,
      title: values.title,
      updated_by: userId,
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeWorkspacePage(data);
}

export type UpdateDocumentInput = {
  accountId: string | null;
  body: string;
  docId: string;
  docType: WorkspacePage['doc_type'];
  icon?: string | null;
  isPinned?: boolean;
  parentDocumentId?: string | null;
  position?: number;
  projectId: string | null;
  status: WorkspacePage['status'];
  title: string;
};

export async function updateDocument(values: UpdateDocumentInput) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('documents')
    .update({
      account_id: values.accountId,
      body: values.body,
      doc_type: values.docType,
      icon: values.icon ?? null,
      is_pinned: values.isPinned ?? false,
      last_opened_at: new Date().toISOString(),
      parent_document_id: values.parentDocumentId ?? null,
      position: values.position ?? 0,
      project_id: values.projectId,
      status: values.status,
      title: values.title,
      updated_by: userId,
    })
    .eq('id', values.docId)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeWorkspacePage(data);
}

export async function archiveDocuments(documentIds: string[]) {
  if (!supabase) throw new Error('Supabase nao configurado.');
  if (documentIds.length === 0) return [];

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('documents')
    .update({
      status: 'archived',
      updated_by: userId,
    })
    .in('id', documentIds)
    .select('*');

  if (error) throw error;
  return (data ?? []).map((document) => normalizeWorkspacePage(document));
}
