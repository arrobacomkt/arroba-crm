import { Loader2, Save, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createService, servicesQueryKey, type CreateServiceInput } from './services-queries';

type ServiceAddModalProps = {
  hasRealSession: boolean;
  onClose: () => void;
  onSuccessLocal: (service: CreateServiceInput) => void;
};

export function ServiceAddModal({ hasRealSession, onClose, onSuccessLocal }: ServiceAddModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [recurrence, setRecurrence] = useState<'monthly' | 'one_off'>('monthly');

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: servicesQueryKey });
      toast.success('Serviço criado com sucesso!');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPrice = Number(price);

    if (!cleanName || Number.isNaN(cleanPrice) || cleanPrice < 0) {
      toast.error('Revise os dados do serviço.');
      return;
    }

    const payload: CreateServiceInput = {
      name: cleanName,
      defaultPrice: cleanPrice,
      recurrence,
    };

    if (hasRealSession) {
      createMutation.mutate(payload);
    } else {
      onSuccessLocal(payload);
      toast.success('Serviço criado localmente!');
      onClose();
    }
  }

  const isSaving = createMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        aria-modal="true"
        className="w-full max-w-md rounded-md border border-border bg-card shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold text-brand">Novo Serviço</h2>
            <p className="mt-1 text-sm text-muted-foreground">Adicionar item ao catálogo</p>
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
            <span className="mb-1 block text-sm font-medium">Nome do serviço</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Preço Padrão (R$)</span>
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
              <span className="mb-1 block text-sm font-medium">Recorrência</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as 'monthly' | 'one_off')}
                disabled={isSaving}
              >
                <option value="monthly">Mensal</option>
                <option value="one_off">Avulso (Única vez)</option>
              </select>
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
            <Button type="button" variant="secondary" disabled={isSaving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 animate-spin" size={16} />
              ) : (
                <Save className="mr-2" size={16} />
              )}
              Salvar Serviço
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
