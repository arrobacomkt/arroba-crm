import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/app/dashboard" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/app',
    element: <Navigate to="/app/dashboard" replace />,
  },
  {
    path: '/app/dashboard',
    element: (
      <ProtectedRoute>
        <AppShell>
          <DashboardPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/leads',
    element: (
      <ProtectedRoute>
        <AppShell>
          <CommercialPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/clientes',
    element: (
      <ProtectedRoute>
        <AppShell>
          <ClientsPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/servicos',
    element: (
      <ProtectedRoute>
        <AppShell>
          <ServicesPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/projetos',
    element: (
      <ProtectedRoute>
        <AppShell>
          <ProjectsPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/tarefas',
    element: (
      <ProtectedRoute>
        <AppShell>
          <TasksPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/calendario',
    element: (
      <ProtectedRoute>
        <AppShell>
          <CalendarPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/documentos',
    element: (
      <ProtectedRoute>
        <AppShell>
          <DocumentsPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/chat',
    element: (
      <ProtectedRoute>
        <AppShell>
          <ChatPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/configuracoes',
    element: (
      <ProtectedRoute>
        <AppShell>
          <SettingsPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/app/dashboard" replace />,
  },
]);
