import { useQuery } from '@tanstack/react-query';
import { Building2, CircleDollarSign, Loader2, MapPin, Search, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import {
  type ClientWithServices,
  type CommercialLead,
  initialBillingCycles,
  initialClientServices,
  initialCommercialLeads,
} from '@/features/opportunities/commercial-data';
import {
  commercialQueryKey,
  fetchCommercialData,
} from '@/features/opportunities/commercial-queries';
import { formatBrl } from '@/lib/formatters/brl';
import { ClientDetailsModal } from './client-details-modal';

function formatDate(value: string | null) {
  if (!value) return 'Sem data';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildClientServices(lead: CommercialLead): ClientWithServices {
  const isLocalMock = lead.opportunity.id.startsWith('opp-');
  return {
    account: lead.account,
    contact: lead.contact,
    services: isLocalMock
      ? initialClientServices.filter((s) => s.account_id === lead.account.id)
      : [],
    billingCycles: isLocalMock
      ? initialBillingCycles.filter((c) => c.account_id === lead.account.id)
      : [],
  };
}

export function ClientsPage() {
  const { isSupabaseConfigured, user } = useAuth();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';
  const commercialQuery = useQuery({
    queryKey: commercialQueryKey,
    queryFn: fetchCommercialData,
    enabled: hasRealSession,
  });
  const leads = useMemo(
    () => (hasRealSession ? (commercialQuery.data?.leads ?? []) : initialCommercialLeads),
    [commercialQuery.data?.leads, hasRealSession],
  );
  const clients = useMemo(() => {
    const byAccount = new Map<string, (typeof leads)[number]>();

    for (const lead of leads) {
      if (lead.account.lifecycle_status !== 'client') continue;

      const current = byAccount.get(lead.account.id);
      if (!current) {
        byAccount.set(lead.account.id, lead);
        continue;
      }

      const currentDate = new Date(
        current.opportunity.converted_at ?? current.opportunity.updated_at,
      );
      const nextDate = new Date(lead.opportunity.converted_at ?? lead.opportunity.updated_at);
      if (nextDate > currentDate) {
        byAccount.set(lead.account.id, lead);
      }
    }

    return Array.from(byAccount.values()).sort((first, second) =>
      first.account.display_name.localeCompare(second.account.display_name, 'pt-BR'),
    );
  }, [leads]);
  const estimatedMonthlyValue = clients.reduce(
    (total, client) => total + (client.opportunity.estimated_value ?? 0),
    0,
  );

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const selectedClient = useMemo(
    () => clients.find((c) => c.account.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const selectedClientWithServices = useMemo(
    () => (selectedClient ? buildClientServices(selectedClient) : null),
    [selectedClient],
  );
  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [
        client.account.display_name,
        client.account.segment ?? '',
        client.account.city ?? '',
        client.contact.full_name,
        client.opportunity.title,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [clients, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contas convertidas a partir do pipeline comercial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {commercialQuery.isFetching ? (
            <Badge tone="neutral">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Atualizando
            </Badge>
          ) : null}
          <Badge tone={hasRealSession ? 'success' : 'neutral'}>
            {hasRealSession ? 'Supabase' : 'Local'}
          </Badge>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Clientes ativos</p>
              <p className="mt-2 text-2xl font-bold data-tabular">{clients.length}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <Building2 size={20} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Valor originado</p>
              <p className="mt-2 text-2xl font-bold data-tabular">
                {formatBrl(estimatedMonthlyValue)}
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <CircleDollarSign size={20} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Com contato principal</p>
              <p className="mt-2 text-2xl font-bold data-tabular">
                {clients.filter((client) => client.contact.full_name).length}
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <UserRound size={20} />
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Carteira de clientes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredClients.length} cliente(s) visivel(is) na carteira.
              </p>
            </div>
            <div className="relative w-full max-w-80">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                className="pl-9"
                placeholder="Buscar cliente, contato ou segmento..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {commercialQuery.isError ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              {commercialQuery.error.message}
            </p>
          ) : filteredClients.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredClients.map((client) => (
                <article
                  key={client.account.id}
                  className="rounded-md border border-border p-4 cursor-pointer hover:border-brand/50 hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedClientId(client.account.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{client.account.display_name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {client.account.segment ?? 'Sem segmento'}
                      </p>
                    </div>
                    <Badge tone="success">Ativo</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <UserRound size={16} />
                      <span>{client.contact.full_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin size={16} />
                      <span>
                        {client.account.city ?? 'Sem cidade'}
                        {client.account.state ? `/${client.account.state}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md bg-muted p-3">
                    <p className="text-sm font-semibold">{client.opportunity.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>Convertido em {formatDate(client.opportunity.converted_at)}</span>
                      <span className="font-semibold data-tabular text-foreground">
                        {formatBrl(client.opportunity.estimated_value ?? 0)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : clients.length > 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="Nenhum cliente encontrado"
              description="Ajuste o termo da busca para localizar outra conta da carteira."
            />
          ) : (
            <EmptyState
              icon={<Building2 size={22} />}
              title="Nenhum cliente ativo ainda"
              description="Mova uma oportunidade para Fechado ganho para converter a conta em cliente."
            />
          )}
        </CardContent>
      </Card>

      {selectedClientWithServices ? (
        <ClientDetailsModal
          key={selectedClientWithServices.account.id}
          clientWithServices={selectedClientWithServices}
          onClose={() => setSelectedClientId(null)}
        />
      ) : null}
    </div>
  );
}
