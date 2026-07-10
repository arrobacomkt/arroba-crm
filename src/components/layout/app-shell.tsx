import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  SquareCheckBig,
  UsersRound,
} from 'lucide-react';
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { NotificationBell } from '@/features/workspaces/notification-bell';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { localWorkspaceOwnerId, markLocalNotificationAsRead } from '@/features/workspaces/workspace-data';
import { markNotificationAsRead } from '@/features/workspaces/workspace-queries';
import { buildWorkspaceInitials } from '@/features/workspaces/workspace-utils';
import { cn } from '@/lib/utils/cn';

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/comercial', label: 'Comercial', icon: BarChart3 },
  { to: '/clientes', label: 'Clientes', icon: UsersRound },
  { to: '/servicos', label: 'Servicos', icon: BriefcaseBusiness },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban },
  { to: '/tarefas', label: 'Tarefas', icon: SquareCheckBig },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/documentos', label: 'Documentos', icon: FileText },
  { to: '/chat', label: 'Chat', icon: MessageSquareText },
  { to: '/configuracoes', label: 'Configuracoes', icon: Settings },
];

export function AppShell({ children }: PropsWithChildren) {
  const { user, signOut, isSupabaseConfigured } = useAuth();
  const { currentWorkspace, notifications, refreshWorkspaceState } = useWorkspace();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== localWorkspaceOwnerId;

  const workspacePrefix = useMemo(
    () => (currentWorkspace ? `/w/${currentWorkspace.slug}` : '/workspaces'),
    [currentWorkspace],
  );

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!currentWorkspace) return;

    document.title = `${currentWorkspace.name} · Arroba CRM`;
    const favicon =
      document.querySelector<HTMLLinkElement>("link[rel='icon']") ??
      Object.assign(document.createElement('link'), { rel: 'icon' });

    if (currentWorkspace.faviconFileId || currentWorkspace.iconFileId) {
      favicon.href = currentWorkspace.faviconFileId ?? currentWorkspace.iconFileId ?? favicon.href;
    }

    if (!favicon.parentNode) {
      document.head.appendChild(favicon);
    }
  }, [currentWorkspace]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {isMobileNavOpen ? (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          type="button"
          onClick={() => setIsMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all',
          isMobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          isCollapsed ? 'w-16' : 'w-[260px]',
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand text-sm font-bold text-white">
            {currentWorkspace ? buildWorkspaceInitials(currentWorkspace.name) : '@'}
          </div>
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{currentWorkspace?.name ?? 'Arroba CRM'}</p>
              <p className="truncate text-xs text-sidebar-muted">Workspace ativo</p>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-muted transition-colors',
                  'hover:bg-sidebar-accent hover:text-white',
                  isActive && 'bg-sidebar-accent text-white',
                  isActive &&
                    'before:absolute before:left-0 before:top-2 before:h-6 before:w-[3px] before:rounded-full before:bg-brand',
                  isCollapsed && 'justify-center px-0',
                )
              }
              to={`${workspacePrefix}${item.to}`}
              title={isCollapsed ? item.label : undefined}
              onClick={() => setIsMobileNavOpen(false)}
            >
              <item.icon size={18} />
              {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button
            className={cn('mb-3 w-full', isCollapsed && 'px-0')}
            type="button"
            variant="ghost"
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!isCollapsed ? 'Recolher' : null}
          </Button>
          <Button
            className={cn('w-full', isCollapsed && 'px-0')}
            type="button"
            variant="ghost"
            onClick={signOut}
          >
            <LogOut size={18} />
            {!isCollapsed ? 'Sair' : null}
          </Button>
        </div>
      </aside>

      <div className={cn('transition-all lg:pl-[260px]', isCollapsed && 'lg:pl-16')}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              className="h-10 w-10 px-0 lg:hidden"
              type="button"
              variant="ghost"
              onClick={() => setIsMobileNavOpen((value) => !value)}
            >
              {isMobileNavOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
            </Button>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {currentWorkspace?.name ?? 'Workspace Arroba CRM'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentWorkspace?.timezone ?? 'America/Sao_Paulo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell
              onMarkRead={(notificationId) => {
                if (hasRealSession) {
                  void markNotificationAsRead(notificationId).then(() => refreshWorkspaceState());
                } else {
                  markLocalNotificationAsRead(user?.id ?? localWorkspaceOwnerId, notificationId);
                  void refreshWorkspaceState();
                }
              }}
            />
            <Button className="hidden sm:inline-flex" type="button" variant="secondary">
              <Search size={18} />
              Buscar
            </Button>
            {!isSupabaseConfigured ? <Badge tone="warning">Local</Badge> : null}
            {notifications.some((notification) => !notification.readAt) ? (
              <Badge tone="warning">Novidades</Badge>
            ) : null}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground">{currentWorkspace?.userRole ?? user?.role}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] p-4 lg:p-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
