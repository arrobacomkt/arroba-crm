export const projectTypeOptions = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'one_off', label: 'Avulso' },
  { value: 'monthly', label: 'Recorrente' },
] as const;

export const projectStatusOptions = [
  { value: 'planned', label: 'Planejado' },
  { value: 'active', label: 'Ativo' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'completed', label: 'Concluido' },
  { value: 'archived', label: 'Arquivado' },
] as const;

export const taskStatusOptions = [
  { value: 'todo', label: 'A fazer' },
  { value: 'doing', label: 'Em andamento' },
  { value: 'done', label: 'Concluida' },
] as const;

export const taskPriorityOptions = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
] as const;

export const projectTypeLabels: Record<string, string> = Object.fromEntries(
  projectTypeOptions.map((option) => [option.value, option.label]),
);

export const projectStatusLabels: Record<string, string> = Object.fromEntries(
  projectStatusOptions.map((option) => [option.value, option.label]),
);

export const taskStatusLabels: Record<string, string> = Object.fromEntries(
  taskStatusOptions.map((option) => [option.value, option.label]),
);

export const taskPriorityLabels: Record<string, string> = Object.fromEntries(
  taskPriorityOptions.map((option) => [option.value, option.label]),
);

export function projectStatusTone(status: string) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'blocked':
      return 'danger' as const;
    case 'completed':
      return 'brand' as const;
    case 'archived':
      return 'neutral' as const;
    default:
      return 'warning' as const;
  }
}

export function taskStatusTone(status: string) {
  switch (status) {
    case 'doing':
      return 'warning' as const;
    case 'done':
      return 'success' as const;
    default:
      return 'neutral' as const;
  }
}

export function taskPriorityTone(priority: string) {
  switch (priority) {
    case 'high':
      return 'danger' as const;
    case 'medium':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}
