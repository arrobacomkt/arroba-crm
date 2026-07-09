import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createLocalDocument,
  loadLocalDocumentWorkspace,
  updateLocalDocument,
} from '@/features/documents/documents-data';

describe('documents local workspace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('doc-new-id');
  });

  it('loads seeded documents when local storage is empty', () => {
    const workspace = loadLocalDocumentWorkspace();

    expect(workspace.documents.length).toBeGreaterThan(0);
    expect(workspace.documents[0]?.organization_id).toBe('org-arroba-local');
    expect(workspace.accounts.length).toBeGreaterThan(0);
    expect(workspace.projects.length).toBeGreaterThan(0);
  });

  it('creates a new local document and persists it', () => {
    const workspace = loadLocalDocumentWorkspace();

    const nextWorkspace = createLocalDocument(workspace, {
      title: 'Checklist de entrega',
      body: 'Primeiro bloco\nSegundo bloco',
      docType: 'note',
      status: 'draft',
      accountId: 'account-kianda',
      projectId: 'project-kianda-onboarding',
    });

    expect(nextWorkspace.documents[0]?.id).toBe('doc-new-id');
    expect(nextWorkspace.documents[0]?.title).toBe('Checklist de entrega');
    expect(nextWorkspace.documents[0]?.doc_type).toBe('note');

    const stored = window.localStorage.getItem('arrobaco.localDocumentsWorkspace');
    expect(stored).toContain('Checklist de entrega');
  });

  it('updates an existing local document and keeps persistence in sync', () => {
    const workspace = loadLocalDocumentWorkspace();
    const existingDocument = workspace.documents[0];
    expect(existingDocument).toBeTruthy();

    const nextWorkspace = updateLocalDocument(workspace, {
      docId: existingDocument!.id,
      title: 'Briefing final Kianda',
      body: 'Resumo revisado',
      docType: 'briefing',
      status: 'approved',
      accountId: existingDocument!.account_id,
      projectId: existingDocument!.project_id,
    });

    const updatedDocument = nextWorkspace.documents.find((item) => item.id === existingDocument!.id);
    expect(updatedDocument?.title).toBe('Briefing final Kianda');
    expect(updatedDocument?.body).toBe('Resumo revisado');
    expect(updatedDocument?.status).toBe('approved');

    const stored = window.localStorage.getItem('arrobaco.localDocumentsWorkspace');
    expect(stored).toContain('Briefing final Kianda');
  });
});
