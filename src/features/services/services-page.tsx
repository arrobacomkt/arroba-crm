import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import { formatBrl } from '@/lib/formatters/brl';

import { initialServiceCatalog } from './services-data';
import { fetchServiceCatalog, servicesQueryKey } from './services-queries';
import { ServiceAddModal } from './service-add-modal';

export function ServicesPage() {
  const { isSupabaseConfigured, user } = useAuth();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';

  const [localCatalog, setLocalCatalog] = useState(initialServiceCatalog);
  const [showAddModal, setShowAddModal] = useState(false);

  const catalogQuery = useQuery({
    queryKey: servicesQueryKey,
    queryFn: fetchServiceCatalog,
    enabled: hasRealSession,
  });

  const catalog = useMemo(
    () => (hasRealSession ? (catalogQuery.data ?? []) : localCatalog),
    [catalogQuery.data, hasRealSession, localCatalog],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo de Serviços</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os planos e serviços oferecidos pela Arroba Co.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {catalogQuery.isFetching ? (
            <Badge tone="neutral">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Atualizando
            </Badge>
          ) : null}
          <Badge tone={hasRealSession ? 'success' : 'neutral'}>
            {hasRealSession ? 'Supabase' : 'Local'}
          </Badge>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={18} /> Novo serviço
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Serviços</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalog.map((service) => (
              <article key={service.id} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{service.name}</h3>
                  <Badge tone={service.is_active ? 'success' : 'neutral'}>
                    {service.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold data-tabular">
                    {formatBrl(service.default_price)}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase">
                    {service.recurrence === 'monthly' ? 'Mensal' : 'Avulso'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      {showAddModal ? (
        <ServiceAddModal
          hasRealSession={hasRealSession}
          onClose={() => setShowAddModal(false)}
          onSuccessLocal={(payload) => {
            setLocalCatalog((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                organization_id: 'org-arroba-local',
                name: payload.name,
                description: null,
                default_price: payload.defaultPrice,
                recurrence: payload.recurrence,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ]);
          }}
        />
      ) : null}
    </div>
  );
}
