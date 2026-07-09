import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Project } from '@/types/database';

import {
  projectStatusOptions,
  projectTypeOptions,
  projectStatusLabels,
  projectTypeLabels,
} from './projects-constants';
import type { ProjectAccountOption } from './projects-data';
import {
  createProject,
  projectsWorkspaceQueryKey,
  type CreateProjectInput,
} from './projects-queries';

type ProjectAddModalProps = {
  accounts: ProjectAccountOption[];
  hasRealSession: boolean;
  onClose: () => void;
  onSuccessLocal: (project: CreateProjectInput) => void;
};

export function ProjectAddModal({
  accounts,
  hasRealSession,
  onClose,
  onSuccessLocal,
}: ProjectAddModalProps) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<Project['project_type']>('onboarding');
  const [status, setStatus] = useState<Project['status']>('planned');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsWorkspaceQueryKey });
      toast.success('Projeto criado com sucesso.');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreateProjectInput = {
      accountId,
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      projectType,
      status,
      startDate: startDate || null,
      dueDate: dueDate || null,
    };

    if (!payload.accountId || !payload.title) {
      toast.error('Preencha cliente e titulo do projeto.');
      return;
    }

    if (hasRealSession) {
      createMutation.mutate(payload);
      return;
    }

    onSuccessLocal(payload);
    toast.success('Projeto criado localmente.');
    onClose();
  }

  const isSaving = createMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        aria-modal="true"
        className="w-full max-w-2xl rounded-md border border-border bg-card shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold text-brand">Novo projeto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organize onboarding, entregas avulsas e operacao recorrente.
            </p>
          </div>
          <Button
            className="h-8 w-8 px-0"
            title="Fechar"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Cliente</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                disabled={isSaving || accounts.length === 0}
                value={accountId || accounts[0]?.id || ''}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {accounts.length === 0 ? <option value="">Nenhum cliente ativo</option> : null}
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.display_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Tipo</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                disabled={isSaving}
                value={projectType}
                onChange={(event) => setProjectType(event.target.value as Project['project_type'])}
              >
                {projectTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {projectTypeLabels[option.value]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Titulo</span>
            <Input
              disabled={isSaving}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Contexto</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              disabled={isSaving}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Status inicial</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                disabled={isSaving}
                value={status}
                onChange={(event) => setStatus(event.target.value as Project['status'])}
              >
                {projectStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {projectStatusLabels[option.value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Inicio</span>
              <Input
                disabled={isSaving}
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Prazo</span>
              <Input
                disabled={isSaving}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button disabled={isSaving} type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={isSaving || accounts.length === 0} type="submit">
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar projeto
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
