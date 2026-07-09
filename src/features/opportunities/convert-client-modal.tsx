import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { formatBrl } from '@/lib/formatters/brl';
import { servicesQueryKey, fetchServiceCatalog } from '@/features/services/services-queries';
import { initialServiceCatalog } from '@/features/services/services-data';
import type { CommercialLead } from './commercial-data';
import { convertOpportunityToClient } from './commercial-queries';
import { commercialQueryKey } from './commercial-queries';

type ConvertClientModalProps = {
  lead: CommercialLead;
  onClose: () => void;
  onSuccess: () => void;
};

export function ConvertClientModal({ lead, onClose, onSuccess }: ConvertClientModalProps) {
  const { isSupabaseConfigured, user } = useAuth();
  const queryClient = useQueryClient();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';

  const catalogQuery = useQuery({
    queryKey: servicesQueryKey,
    queryFn: fetchServiceCatalog,
    enabled: hasRealSession,
  });

  const catalog = useMemo(
    () => (hasRealSession ? (catalogQuery.data ?? []) : initialServiceCatalog),
    [catalogQuery.data, hasRealSession],
  );

  const [selectedServices, setSelectedServices] = useState<
    Array<{ id: string; catalogId: string; price: string; billingDay: string }>
  >([]);

  const convertMutation = useMutation({
    mutationFn: convertOpportunityToClient,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commercialQueryKey });
      toast.success('Cliente convertido e serviços adicionados!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function handleAddService(catalogId: string) {
    const service = catalog.find((c) => c.id === catalogId);
    if (!service) return;

    setSelectedServices((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        catalogId,
        price: String(service.default_price),
        billingDay: service.recurrence === 'monthly' ? '5' : '',
      },
    ]);
  }

  function handleRemoveService(id: string) {
    setSelectedServices((current) => current.filter((s) => s.id !== id));
  }

  function handleUpdateService(id: string, field: 'price' | 'billingDay', value: string) {
    setSelectedServices((current) =>
      current.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const servicesPayload = selectedServices.map((s) => {
      const serviceDef = catalog.find((c) => c.id === s.catalogId);
      return {
        service_catalog_id: s.catalogId,
        contracted_price: Number(s.price),
        recurrence: serviceDef?.recurrence ?? 'one_off',
        billing_day: serviceDef?.recurrence === 'monthly' ? Number(s.billingDay) : null,
        account_unit_ids: [],
      };
    });

    if (hasRealSession) {
      convertMutation.mutate({
        opportunityId: lead.opportunity.id,
        services: servicesPayload,
      });
    } else {
      toast.success('Modo local: Cliente seria convertido com os serviços selecionados.');
      onSuccess();
    }
  }

  const isSaving = convertMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        aria-modal="true"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-md border border-border bg-card shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold text-lg text-brand">Converter Oportunidade em Cliente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A conta <strong className="text-foreground">{lead.account.display_name}</strong> será
              convertida em cliente. Defina os serviços que foram contratados.
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

        <form className="p-5" onSubmit={handleSubmit}>
          <div className="mb-6 space-y-3">
            <h3 className="font-semibold text-sm">Adicionar Serviços</h3>
            <div className="flex gap-2 flex-wrap">
              {catalog.map((service) => (
                <Badge
                  key={service.id}
                  tone="neutral"
                  className="cursor-pointer hover:bg-brand/10 transition-colors"
                  onClick={() => handleAddService(service.id)}
                >
                  <Plus size={12} className="mr-1" />
                  {service.name} ({formatBrl(service.default_price)})
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3 min-h-32">
            <h3 className="font-semibold text-sm">
              Serviços Contratados ({selectedServices.length})
            </h3>

            {selectedServices.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-center text-muted-foreground">
                Nenhum serviço selecionado. Você pode converter sem serviços, mas é recomendado
                adicionar os itens da proposta.
              </p>
            ) : (
              selectedServices.map((s) => {
                const serviceDef = catalog.find((c) => c.id === s.catalogId);
                return (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-border p-3"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{serviceDef?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {serviceDef?.recurrence === 'monthly' ? 'Mensal' : 'Avulso'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">Valor Final (R$)</span>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 w-28"
                          value={s.price}
                          onChange={(e) => handleUpdateService(s.id, 'price', e.target.value)}
                          required
                        />
                      </label>
                      {serviceDef?.recurrence === 'monthly' && (
                        <label className="flex flex-col">
                          <span className="text-xs text-muted-foreground mb-1">Dia Venc.</span>
                          <Input
                            type="number"
                            min="1"
                            max="31"
                            className="h-8 w-16"
                            value={s.billingDay}
                            onChange={(e) =>
                              handleUpdateService(s.id, 'billingDay', e.target.value)
                            }
                            required
                          />
                        </label>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 px-0 text-danger mt-5"
                        onClick={() => handleRemoveService(s.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-border pt-4">
            <Button type="button" variant="secondary" disabled={isSaving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Confirmar Conversão
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
