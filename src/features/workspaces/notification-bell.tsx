import { Bell } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useWorkspace } from './workspace-context';

type NotificationBellProps = {
  onMarkRead?: (notificationId: string) => void;
};

export function NotificationBell({ onMarkRead }: NotificationBellProps) {
  const { notifications } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="relative">
      <Button className="h-10 w-10 px-0" type="button" variant="ghost" onClick={() => setIsOpen((value) => !value)}>
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-40 w-[320px] rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Notificacoes</h3>
            <Badge tone={unreadCount > 0 ? 'warning' : 'success'}>{unreadCount} nova(s)</Badge>
          </div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.slice(0, 8).map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{notification.title}</p>
                      {notification.body ? (
                        <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                      ) : null}
                    </div>
                    {!notification.readAt ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand" /> : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleString('pt-BR')}
                    </span>
                    <div className="flex gap-2">
                      {notification.actionUrl ? (
                        <Link
                          className="text-xs font-semibold text-brand"
                          to={notification.actionUrl}
                          onClick={() => setIsOpen(false)}
                        >
                          Abrir
                        </Link>
                      ) : null}
                      {!notification.readAt && onMarkRead ? (
                        <button
                          className="text-xs font-semibold text-muted-foreground"
                          type="button"
                          onClick={() => onMarkRead(notification.id)}
                        >
                          Marcar como lida
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhuma notificacao por enquanto.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
