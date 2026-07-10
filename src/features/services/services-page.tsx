import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, PencilLine, Plus, Power, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { serviceTabs } from '@/app/module-tabs-config';
import { ModulePageLayout } from '@/components/layout/module-page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { formatBrl } from '@/lib/formatters/brl';
import type { ServiceCatalog } from '@/types/database';

import { ServiceAddModal } from './service-add-modal';
import { initialServiceCatalog } from './services-data';
import { fetchServiceCatalog, servicesQueryKey, updateService } from './services-queries';

export function ServicesPage() {
  const location = useLocation();
  const { isSupabaseConfigured, user } = useAuth();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';
  const queryClient = useQueryClient();
  const currentTab = location.pathname.split('/').pop() ?? 'contratados';

  const [localCatalog, setLocalCatalog] = useState(initialServiceCatalog);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalog | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const catalogQuery = useQuery({
    queryKey: servicesQueryKey,
    queryFn: fetchServiceCatalog,
    enabled: hasRealSession,
  });

  const catalog = useMemo(
    () => (hasRealSession ? (catalogQuery.data ?? []) : localCatalog),
    [catalogQuery.data, hasRealSession, localCatalog],
  );

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...catalog]
      .filter((service) => {
        if (currentTab === 'contratados' && !service.is_active) return false;
        if (currentTab === 'cobrancas' && service.recurrence !== 'monthly') return false;
        if (currentTab === 'renovacoes' && service.recurrence !== 'monthly') return false;
        if (currentTab === 'upgrades' && !service.is_active) return false;
        if (statusFilter === 'active' && !service.is_active) return false;
        if (statusFilter === 'inactive' && service.is_active) return false;
        if (!normalizedSearch) return true;

        const haystack = [service.name, service.description ?? ''].join(' ').toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((first, second) => {
        if (first.is_active !== second.is_active) return first.is_active ? -1 : 1;
        return first.name.localeCompare(second.name, 'pt-BR');
      });
  }, [catalog, currentTab, search, statusFilter]);

  const serviceStats = useMemo(
    () => ({
      total: catalog.length,
      active: catalog.filter((service) => service.is_active).length,
      inactive: catalog.filter((service) => !service.is_active).length,
      monthly: catalog.filter((service) => service.recurrence === 'monthly').length,
    }),
    [catalog],
  );

  const toggleActiveMutation = useMutation({
    mutationFn: updateService,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: servicesQueryKey });
      toast.success(
        variables.isActive ? 'Servico ativado com sucesso!' : 'Servico inativado com sucesso!',
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function updateLocalService(
    serviceId: string,
    updater: (current: ServiceCatalog) => ServiceCatalog,
  ) {
    setLocalCatalog((current) =>
      current.map((service) => (service.id === serviceId ? updater(service) : service)),
    );
  }

  function handleToggleService(service: ServiceCatalog) {
    if (hasRealSession) {
      toggleActiveMutation.mutate({
        serviceId: service.id,
        name: service.name,
        description: service.description,
        defaultPrice: service.default_price,
        recurrence: service.recurrence,
        isActive: !service.is_active,
      });
      return;
    }

    updateLocalService(service.id, (current) => ({
      ...current,
      is_active: !current.is_active,
      updated_at: new Date().toISOString(),
    }));
    toast.success(
      service.is_active ? 'Servico inativado localmente!' : 'Servico ativado localmente!',
    );
  }

  return (
    <ModulePageLayout
      title="Servicos"
      description="Catalogo, contratados e visoes operacionais agora separados por contexto."
      breadcrumbs={[
        { label: 'Servicos', to: '/app/servicos/contratados' },
        { label: serviceTabs.find((tab) => tab.to.endsWith(`/${currentTab}`))?.label ?? 'Contratados' },
      ]}
      tabs={serviceTabs}
      actions={
        <>
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
            <Plus size={18} />
            Novo servico
          </Button>
        </>
      }
    >

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Servicos" value={String(serviceStats.total)} />
        <MetricCard label="Ativos" value={String(serviceStats.active)} />
        <MetricCard label="Inativos" value={String(serviceStats.inactive)} />
        <MetricCard label="Mensais" value={String(serviceStats.monthly)} />
      </section>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">
                {currentTab === 'catalogo'
                  ? 'Catalogo'
                  : currentTab === 'cobrancas'
                    ? 'Base para cobrancas'
                    : currentTab === 'renovacoes'
                      ? 'Renovacoes em foco'
                      : currentTab === 'upgrades'
                        ? 'Oportunidades de upgrade'
                        : 'Servicos contratados'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentTab === 'catalogo'
                  ? 'Edite, filtre e controle a disponibilidade do catalogo.'
                  : 'Recorte operacional construído sobre a base atual do MVP.'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <label className="relative block">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome ou descricao"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="block">
                <select
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')
                  }
                >
                  <option value="all">Todos</option>
                  <option value="active">Somente ativos</option>
                  <option value="inactive">Somente inativos</option>
                </select>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCatalog.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCatalog.map((service) => (
                <article key={service.id} className="rounded-md border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {service.description || 'Sem descricao adicional para este servico.'}
                      </p>
                    </div>
                    <Badge tone={service.is_active ? 'success' : 'neutral'}>
                      {service.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="neutral">
                      {service.recurrence === 'monthly' ? 'Mensal' : 'Avulso'}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold data-tabular">
                      {formatBrl(service.default_price)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Atualizado em{' '}
                      {new Date(service.updated_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingService(service)}
                    >
                      <PencilLine size={16} />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleToggleService(service)}
                      disabled={toggleActiveMutation.isPending}
                    >
                      <Power size={16} />
                      {service.is_active ? 'Inativar' : 'Ativar'}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhum servico encontrado com os filtros atuais.
            </p>
          )}
        </CardContent>
      </Card>

      {showAddModal ? (
        <ServiceAddModal
          hasRealSession={hasRealSession}
          mode="create"
          onClose={() => setShowAddModal(false)}
          onCreateLocal={(payload) => {
            setLocalCatalog((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                organization_id: 'org-arroba-local',
                name: payload.name,
                description: payload.description ?? null,
                default_price: payload.defaultPrice,
                recurrence: payload.recurrence,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ]);
          }}
          onUpdateLocal={() => undefined}
        />
      ) : null}

      {editingService ? (
        <ServiceAddModal
          hasRealSession={hasRealSession}
          mode="edit"
          service={editingService}
          onClose={() => setEditingService(null)}
          onCreateLocal={() => undefined}
          onUpdateLocal={(payload) => {
            updateLocalService(payload.serviceId, (current) => ({
              ...current,
              name: payload.name,
              description: payload.description,
              default_price: payload.defaultPrice,
              recurrence: payload.recurrence,
              updated_at: new Date().toISOString(),
            }));
          }}
        />
      ) : null}
    </ModulePageLayout>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold data-tabular">{value}</p>
      </CardContent>
    </Card>
  );
}
