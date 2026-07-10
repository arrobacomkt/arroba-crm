const activeWorkspaceIdKey = 'arrobaco.activeWorkspaceId';
const activeWorkspaceSlugKey = 'arrobaco.activeWorkspaceSlug';

export function readActiveWorkspaceId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(activeWorkspaceIdKey);
}

export function readActiveWorkspaceSlug() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(activeWorkspaceSlugKey);
}

export function writeActiveWorkspace(workspace: { id: string; slug: string }) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(activeWorkspaceIdKey, workspace.id);
  window.localStorage.setItem(activeWorkspaceSlugKey, workspace.slug);
}

export function clearActiveWorkspace() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(activeWorkspaceIdKey);
  window.localStorage.removeItem(activeWorkspaceSlugKey);
}
