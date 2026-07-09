import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ServiceCatalog } from '@/types/database';

import {
  createService,
  servicesQueryKey,
  updateService,
  type CreateServiceInput,
} from './services-queries';

type ServiceAddModalProps = {
  hasRealSession: boolean;
  mode: 'create' | 'edit';
  service?: ServiceCatalog | null;
  onClose: () => void;
  onCreateLocal: (service: CreateServiceInput) => void;
  onUpdateLocal: (payload: {
    serviceId: string;
    name: string;
    description: string | null;
    defaultPrice: number;
    recurrence: 'monthly' | 'one_off';
  }) => void;
};

export function ServiceAddModal({
  hasRealSession,
  mode,
  service,
  onClose,
  onCreateLocal,
  onUpdateLocal,
}: ServiceAddModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? String(service.default_price) : '');
  const [recurrence, setRecurrence] = useState<'monthly' | 'one_off'>(
    service?.recurrence ?? 'monthly',
  );

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: servicesQueryKey });
      toast.success('Servico criado com sucesso!');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateService,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: servicesQueryKey });
      toast.success('Servico atualizado com sucesso!');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    const cleanPrice = Number(price);

    if (!cleanName || Number.isNaN(cleanPrice) || cleanPrice < 0) {
      toast.error('Revise os dados do servico.');
      return;
    }

    if (mode === 'edit') {
      if (!service) return;

      const payload = {
        serviceId: service.id,
        name: cleanName,
        description: cleanDescription || null,
        defaultPrice: cleanPrice,
        recurrence,
        isActive: service.is_active,
      };

      if (hasRealSession) {
        updateMutation.mutate(payload);
      } else {
        onUpdateLocal(payload);
        toast.success('Servico atualizado localmente!');
        onClose();
      }

      return;
    }

    const payload: CreateServiceInput = {
      name: cleanName,
      description: cleanDescription || null,
      defaultPrice: cleanPrice,
      recurrence,
    };

    if (hasRealSession) {
      createMutation.mutate(payload);
    } else {
      onCreateLocal(payload);
      toast.success('Servico criado localmente!');
      onClose();
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        aria-modal="true"
        className="w-full max-w-md rounded-md border border-border bg-card shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold text-brand">
              {mode === 'edit' ? 'Editar servico' : 'Novo servico'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'edit' ? 'Atualize os dados do item no catalogo' : 'Adicionar item ao catalogo'}
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
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nome do servico</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Descricao</span>
            <textarea
              className="min-h-[96px] w-full rounded-md border border-border bg-card px-3 py-3 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              placeholder="Resumo rapido do que este servico entrega."
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Preco padrao (R$)</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={isSaving}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Recorrencia</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as 'monthly' | 'one_off')}
                disabled={isSaving}
              >
                <option value="monthly">Mensal</option>
                <option value="one_off">Avulso</option>
              </select>
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isSaving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 animate-spin" size={16} />
              ) : (
                <Save className="mr-2" size={16} />
              )}
              {mode === 'edit' ? 'Salvar alteracoes' : 'Salvar servico'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
