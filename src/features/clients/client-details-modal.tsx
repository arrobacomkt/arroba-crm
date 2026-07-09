import { CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { initialServiceCatalog } from '@/features/services/services-data';
import type { BillingCycle, ClientService } from '@/types/database';
import type { ClientWithServices } from '@/features/opportunities/commercial-data';
import { formatBrl } from '@/lib/formatters/brl';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchServiceCatalog,
  addClientService,
  servicesQueryKey,
} from '@/features/services/services-queries';

type Tab = 'geral' | 'servicos' | 'faturas';

type ClientDetailsModalProps = {
  clientWithServices: ClientWithServices;
  onClose: () => void;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function getServiceName(service: ClientService) {
  const catalogItem = initialServiceCatalog.find((s) => s.id === service.service_catalog_id);
  return catalogItem?.name ?? 'Serviço';
}

function BillingStatusBadge({ status }: { status: BillingCycle['status'] }) {
  const config: Record<
    string,
    { tone: 'success' | 'danger' | 'warning' | 'neutral'; label: string }
  > = {
    paid: { tone: 'success', label: 'Pago' },
    pending: { tone: 'warning', label: 'Pendente' },
    late: { tone: 'danger', label: 'Atrasado' },
    exempt: { tone: 'neutral', label: 'Isento' },
  };
  const { tone, label } = config[status];
  return <Badge tone={tone}>{label}</Badge>;
}

function ServiceStatusBadge({ status }: { status: ClientService['status'] }) {
  const config: Record<string, { tone: 'success' | 'warning' | 'neutral'; label: string }> = {
    active: { tone: 'success', label: 'Ativo' },
    paused: { tone: 'warning', label: 'Pausado' },
    closed: { tone: 'neutral', label: 'Encerrado' },
  };
  const { tone, label } = config[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ClientDetailsModal({
  clientWithServices: client,
  onClose,
}: ClientDetailsModalProps) {
  const { isSupabaseConfigured, user } = useAuth();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';

  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [localServices, setLocalServices] = useState(client.services);
  const [localCycles, setLocalCycles] = useState(client.billingCycles);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [addServiceCatalogId, setAddServiceCatalogId] = useState('');
  const [addServicePrice, setAddServicePrice] = useState('');
  const [addServiceBillingDay, setAddServiceBillingDay] = useState('5');

  const pendingCount = localCycles.filter(
    (c) => c.status === 'pending' || c.status === 'late',
  ).length;

  const catalogQuery = useQuery({
    queryKey: servicesQueryKey,
    queryFn: fetchServiceCatalog,
    enabled: hasRealSession,
  });

  const catalog = useMemo(
    () => (hasRealSession ? (catalogQuery.data ?? []) : initialServiceCatalog),
    [catalogQuery.data, hasRealSession],
  );

  const addServiceMutation = useMutation({
    mutationFn: addClientService,
    onSuccess: () => {
      toast.success('Serviço adicionado ao cliente!');
      setShowAddService(false);
      resetAddServiceForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const selectedCatalogService = catalog.find((s) => s.id === addServiceCatalogId);
  const selectedRecurrence = selectedCatalogService?.recurrence ?? 'monthly';

  function resetAddServiceForm() {
    setAddServiceCatalogId('');
    setAddServicePrice('');
    setAddServiceBillingDay('5');
  }

  function handleAddServiceLocal() {
    const price = Number(addServicePrice);
    if (!addServiceCatalogId || Number.isNaN(price) || price <= 0) {
      toast.error('Selecione um serviço e informe um valor válido.');
      return;
    }

    const newService: ClientService = {
      id: crypto.randomUUID(),
      organization_id: 'org-arroba-local',
      account_id: client.account.id,
      service_catalog_id: addServiceCatalogId,
      status: 'active',
      contracted_price: price,
      recurrence: selectedRecurrence,
      billing_day: selectedRecurrence === 'monthly' ? Number(addServiceBillingDay) : null,
      valid_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: null,
    };

    setLocalServices((current) => [...current, newService]);
    setShowAddService(false);
    resetAddServiceForm();
    toast.success('Serviço adicionado localmente!');
  }

  function handleAddService() {
    if (!addServiceCatalogId) {
      toast.error('Selecione um serviço do catálogo.');
      return;
    }

    if (hasRealSession) {
      addServiceMutation.mutate({
        accountId: client.account.id,
        serviceCatalogId: addServiceCatalogId,
        contractedPrice: Number(addServicePrice),
        recurrence: selectedRecurrence,
        billingDay: selectedRecurrence === 'monthly' ? Number(addServiceBillingDay) : null,
      });
    } else {
      handleAddServiceLocal();
    }
  }

  function handleMarkAsPaid(cycleId: string) {
    setPayingId(cycleId);
    setTimeout(() => {
      setLocalCycles((current) =>
        current.map((c) =>
          c.id === cycleId
            ? { ...c, status: 'paid' as const, paid_at: new Date().toISOString() }
            : c,
        ),
      );
      setPayingId(null);
      toast.success('Cobrança marcada como paga!');
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        aria-modal="true"
        className="flex w-full max-w-4xl max-h-[90vh] flex-col rounded-md border border-border bg-card shadow-xl"
        role="dialog"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold text-lg text-foreground">{client.account.display_name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cliente desde {formatDate(client.account.created_at)}
            </p>
          </div>
          <Button
            className="h-8 w-8 px-0"
            type="button"
            title="Fechar"
            variant="ghost"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        <div className="flex border-b border-border px-5 gap-6 text-sm overflow-x-auto shrink-0">
          {(['geral', 'servicos', 'faturas'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'geral' ? 'Geral' : tab === 'servicos' ? 'Serviços' : 'Faturas'}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'geral' && (
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold mb-3">Informações de Contato</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Contato Principal</p>
                    <p className="text-sm font-medium mt-1">{client.contact.full_name}</p>
                    {client.contact.whatsapp && (
                      <p className="text-sm mt-1 text-muted-foreground">
                        WA: {client.contact.whatsapp}
                      </p>
                    )}
                    {client.contact.email && (
                      <p className="text-sm mt-1 text-muted-foreground">{client.contact.email}</p>
                    )}
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Endereço / Unidade Sede</p>
                    <p className="text-sm font-medium mt-1">
                      {client.account.city} - {client.account.state}
                    </p>
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold mb-3">Resumo Financeiro</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">MRR (serviços mensais)</p>
                    <p className="text-lg font-bold data-tabular mt-1">
                      {formatBrl(
                        client.services
                          .filter((s) => s.status === 'active' && s.recurrence === 'monthly')
                          .reduce((acc, s) => acc + Number(s.contracted_price), 0),
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total contratado</p>
                    <p className="text-lg font-bold data-tabular mt-1">
                      {formatBrl(
                        client.services
                          .filter((s) => s.status === 'active')
                          .reduce((acc, s) => acc + Number(s.contracted_price), 0),
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Serviços ativos</p>
                    <p className="text-lg font-bold data-tabular mt-1">
                      {client.services.filter((s) => s.status === 'active').length}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'servicos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Serviços Contratados</h3>
                <Button
                  variant="secondary"
                  className="h-8 text-xs"
                  onClick={() => setShowAddService(true)}
                  disabled={showAddService}
                >
                  <Plus size={14} className="mr-1" />
                  Adicionar serviço
                </Button>
              </div>

              {showAddService ? (
                <div className="rounded-md border border-border bg-muted/20 p-4 space-y-4">
                  <h4 className="text-sm font-semibold">Novo serviço contratado</h4>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Serviço do catálogo
                    </span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      value={addServiceCatalogId}
                      onChange={(e) => {
                        const s = catalog.find((c) => c.id === e.target.value);
                        setAddServiceCatalogId(e.target.value);
                        if (s) setAddServicePrice(String(s.default_price));
                      }}
                    >
                      <option value="">Selecione um serviço...</option>
                      {catalog.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatBrl(s.default_price)} —{' '}
                          {s.recurrence === 'monthly' ? 'Mensal' : 'Avulso'})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">
                        Valor contratado (R$)
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={addServicePrice}
                        onChange={(e) => setAddServicePrice(e.target.value)}
                      />
                    </label>
                    {selectedRecurrence === 'monthly' && (
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-muted-foreground">
                          Dia de vencimento
                        </span>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={addServiceBillingDay}
                          onChange={(e) => setAddServiceBillingDay(e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="secondary"
                      className="h-8 text-xs"
                      onClick={() => {
                        setShowAddService(false);
                        resetAddServiceForm();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="h-8 text-xs"
                      disabled={addServiceMutation.isPending}
                      onClick={handleAddService}
                    >
                      {addServiceMutation.isPending ? (
                        <Loader2 className="animate-spin mr-1" size={14} />
                      ) : (
                        <Plus size={14} className="mr-1" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : null}

              {localServices.length > 0 ? (
                <div className="space-y-3">
                  {localServices.map((service) => (
                    <div key={service.id} className="rounded-md border border-border p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{getServiceName(service)}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {service.recurrence === 'monthly' ? 'Mensal' : 'Avulso'}
                            {service.billing_day ? ` · Vencimento dia ${service.billing_day}` : ''}
                          </p>
                        </div>
                        <ServiceStatusBadge status={service.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-lg font-bold data-tabular">
                          {formatBrl(Number(service.contracted_price))}
                        </span>
                        {service.valid_until && (
                          <span className="text-xs text-muted-foreground">
                            Válido até {formatDate(service.valid_until)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 text-muted-foreground/50" size={24} />
                  Nenhum serviço contratado no momento.
                </div>
              )}
            </div>
          )}

          {activeTab === 'faturas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Ciclos de Cobrança</h3>
                {pendingCount > 0 ? (
                  <Badge tone="danger">{pendingCount} pendente(s)</Badge>
                ) : (
                  <Badge tone="success">Em dia</Badge>
                )}
              </div>
              {localCycles.length > 0 ? (
                <div className="space-y-3">
                  {localCycles.map((cycle) => (
                    <div key={cycle.id} className="rounded-md border border-border p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-sm">
                            {getServiceName(
                              localServices.find((s) => s.id === cycle.client_service_id)!,
                            )}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Ref. {formatDate(cycle.reference_month)} · Vence{' '}
                            {formatDate(cycle.due_date)}
                          </p>
                        </div>
                        <BillingStatusBadge status={cycle.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-lg font-bold data-tabular">
                          {formatBrl(Number(cycle.amount))}
                        </span>
                        <div className="flex items-center gap-2">
                          {cycle.paid_at && (
                            <span className="text-xs text-muted-foreground">
                              Pago em {formatDate(cycle.paid_at)}
                            </span>
                          )}
                          {(cycle.status === 'pending' || cycle.status === 'late') && (
                            <Button
                              variant="success"
                              className="h-8 text-xs px-3"
                              disabled={payingId === cycle.id}
                              onClick={() => handleMarkAsPaid(cycle.id)}
                            >
                              {payingId === cycle.id ? (
                                <Loader2 className="animate-spin mr-1" size={14} />
                              ) : (
                                <CheckCircle2 className="mr-1" size={14} />
                              )}
                              {payingId === cycle.id ? 'Confirmando...' : 'Pago'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 text-muted-foreground/50" size={24} />
                  Nenhum ciclo de cobrança encontrado.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
