import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { SignupPage } from '@/features/auth/signup-page';
import { CalendarPage } from '@/features/calendar/calendar-page';
import { ChatPage } from '@/features/chat/chat-page';
import { ClientsPage } from '@/features/clients/clients-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { DocumentsPage } from '@/features/documents/documents-page';
import { CommercialPage } from '@/features/opportunities/commercial-page';
import { ProjectsPage } from '@/features/projects/projects-page';
import { TasksPage } from '@/features/projects/tasks-page';
import { ServicesPage } from '@/features/services/services-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { WorkspaceProvider } from '@/features/workspaces/workspace-provider';
import { WorkspacesHomePage } from '@/features/workspaces/workspaces-home-page';
import { readActiveWorkspaceSlug } from '@/features/workspaces/workspace-storage';

function LastWorkspaceRedirect({ modulePath }: { modulePath: string }) {
  const slug = readActiveWorkspaceSlug();
  return <Navigate replace to={slug ? `/w/${slug}${modulePath}` : '/workspaces'} />;
}

function ClientLegacyRedirect() {
  const location = useLocation();
  const { accountId } = useParams();
  const slug = readActiveWorkspaceSlug();

  return (
    <Navigate
      replace
      to={slug ? `/w/${slug}/clientes/${accountId}/visao-geral${location.search}` : '/workspaces'}
    />
  );
}

function ProjectLegacyRedirect() {
  const location = useLocation();
  const { projectId } = useParams();
  const slug = readActiveWorkspaceSlug();

  return (
    <Navigate
      replace
      to={slug ? `/w/${slug}/projetos/${projectId}/visao-geral${location.search}` : '/workspaces'}
    />
  );
}

function GenericAppRedirect() {
  const location = useLocation();
  const slug = readActiveWorkspaceSlug();
  const nextPath = location.pathname.replace(/^\/app/, '');

  return <Navigate replace to={slug ? `/w/${slug}${nextPath}${location.search}` : '/workspaces'} />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/workspaces" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/cadastro',
    element: <SignupPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/workspaces',
    element: (
      <ProtectedRoute>
        <WorkspaceProvider>
          <WorkspacesHomePage />
        </WorkspaceProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/w/:workspaceSlug',
    element: (
      <ProtectedRoute>
        <WorkspaceProvider>
          <AppShell />
        </WorkspaceProvider>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'comercial',
        children: [
          { index: true, element: <Navigate to="pipeline" replace /> },
          { path: 'pipeline', element: <CommercialPage /> },
          { path: 'leads', element: <CommercialPage /> },
          { path: 'oportunidades', element: <CommercialPage /> },
          { path: 'follow-ups', element: <CommercialPage /> },
          { path: 'propostas', element: <CommercialPage /> },
          { path: 'perdidos', element: <CommercialPage /> },
        ],
      },
      {
        path: 'clientes',
        children: [
          { index: true, element: <Navigate to="ativos" replace /> },
          { path: 'ativos', element: <ClientsPage /> },
          { path: 'onboarding', element: <ClientsPage /> },
          { path: 'pausados', element: <ClientsPage /> },
          { path: 'encerrados', element: <ClientsPage /> },
          { path: ':accountId/visao-geral', element: <ClientsPage /> },
          { path: ':accountId/contatos', element: <ClientsPage /> },
          { path: ':accountId/unidades', element: <ClientsPage /> },
          { path: ':accountId/servicos', element: <ClientsPage /> },
          { path: ':accountId/projetos', element: <ClientsPage /> },
          { path: ':accountId/tarefas', element: <ClientsPage /> },
          { path: ':accountId/documentos', element: <ClientsPage /> },
          { path: ':accountId/arquivos', element: <ClientsPage /> },
          { path: ':accountId/historico', element: <ClientsPage /> },
          { path: ':accountId/chat', element: <ClientsPage /> },
        ],
      },
      {
        path: 'servicos',
        children: [
          { index: true, element: <Navigate to="contratados" replace /> },
          { path: 'contratados', element: <ServicesPage /> },
          { path: 'catalogo', element: <ServicesPage /> },
          { path: 'cobrancas', element: <ServicesPage /> },
          { path: 'renovacoes', element: <ServicesPage /> },
          { path: 'upgrades', element: <ServicesPage /> },
        ],
      },
      {
        path: 'projetos',
        children: [
          { index: true, element: <Navigate to="ativos" replace /> },
          { path: 'ativos', element: <ProjectsPage /> },
          { path: 'ciclos-mensais', element: <ProjectsPage /> },
          { path: 'avulsos', element: <ProjectsPage /> },
          { path: 'onboarding', element: <ProjectsPage /> },
          { path: 'aprovacao', element: <ProjectsPage /> },
          { path: 'concluidos', element: <ProjectsPage /> },
          { path: ':projectId/visao-geral', element: <ProjectsPage /> },
          { path: ':projectId/tarefas', element: <ProjectsPage /> },
          { path: ':projectId/calendario-editorial', element: <ProjectsPage /> },
          { path: ':projectId/conteudos', element: <ProjectsPage /> },
          { path: ':projectId/documentos', element: <ProjectsPage /> },
          { path: ':projectId/arquivos', element: <ProjectsPage /> },
          { path: ':projectId/chat', element: <ProjectsPage /> },
          { path: ':projectId/historico', element: <ProjectsPage /> },
        ],
      },
      {
        path: 'tarefas',
        children: [
          { index: true, element: <Navigate to="lista" replace /> },
          { path: 'lista', element: <TasksPage /> },
          { path: 'kanban', element: <TasksPage /> },
          { path: 'calendario', element: <TasksPage /> },
          { path: 'minhas', element: <TasksPage /> },
          { path: 'atrasadas', element: <TasksPage /> },
        ],
      },
      {
        path: 'calendario',
        element: <CalendarPage />,
      },
      {
        path: 'documentos',
        element: <DocumentsPage />,
      },
      {
        path: 'documentos/pagina/:documentId',
        element: <DocumentsPage />,
      },
      {
        path: 'documentos/recentes',
        element: <DocumentsPage />,
      },
      {
        path: 'documentos/favoritos',
        element: <DocumentsPage />,
      },
      {
        path: 'documentos/arquivados',
        element: <DocumentsPage />,
      },
      {
        path: 'documentos/cliente/:accountId',
        element: <DocumentsPage />,
      },
      {
        path: 'documentos/projeto/:projectId',
        element: <DocumentsPage />,
      },
      {
        path: 'chat',
        element: <ChatPage />,
      },
      {
        path: 'chat/canal/:channelId',
        element: <ChatPage />,
      },
      {
        path: 'configuracoes',
        children: [
          { index: true, element: <Navigate to="geral" replace /> },
          { path: 'geral', element: <SettingsPage /> },
          { path: 'usuarios', element: <SettingsPage /> },
          { path: 'pipeline', element: <SettingsPage /> },
          { path: 'catalogo-servicos', element: <SettingsPage /> },
          { path: 'modelos', element: <SettingsPage /> },
          { path: 'seguranca', element: <SettingsPage /> },
          { path: 'aparencia', element: <SettingsPage /> },
          { path: 'sistema', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: '/app/leads',
    element: <LastWorkspaceRedirect modulePath="/comercial/leads" />,
  },
  {
    path: '/app/documentos/todos',
    element: <LastWorkspaceRedirect modulePath="/documentos" />,
  },
  {
    path: '/app/documentos/briefings',
    element: <LastWorkspaceRedirect modulePath="/documentos" />,
  },
  {
    path: '/app/documentos/roteiros',
    element: <LastWorkspaceRedirect modulePath="/documentos" />,
  },
  {
    path: '/app/documentos/calendarios',
    element: <LastWorkspaceRedirect modulePath="/documentos" />,
  },
  {
    path: '/app/documentos/relatorios',
    element: <LastWorkspaceRedirect modulePath="/documentos" />,
  },
  {
    path: '/app/documentos/guias-de-marca',
    element: <LastWorkspaceRedirect modulePath="/documentos" />,
  },
  {
    path: '/app/chat/gerais',
    element: <LastWorkspaceRedirect modulePath="/chat" />,
  },
  {
    path: '/app/chat/clientes',
    element: <LastWorkspaceRedirect modulePath="/chat" />,
  },
  {
    path: '/app/chat/projetos',
    element: <LastWorkspaceRedirect modulePath="/chat" />,
  },
  {
    path: '/app/chat/leads',
    element: <LastWorkspaceRedirect modulePath="/chat" />,
  },
  {
    path: '/app/chat/arquivados',
    element: <LastWorkspaceRedirect modulePath="/chat" />,
  },
  {
    path: '/app/oportunidades',
    element: <LastWorkspaceRedirect modulePath="/comercial/oportunidades" />,
  },
  {
    path: '/app/clientes/:accountId',
    element: <ClientLegacyRedirect />,
  },
  {
    path: '/app/projetos/:projectId',
    element: <ProjectLegacyRedirect />,
  },
  {
    path: '/app/*',
    element: <GenericAppRedirect />,
  },
  {
    path: '*',
    element: <Navigate to="/workspaces" replace />,
  },
]);
