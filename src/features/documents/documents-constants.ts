export const documentTypeOptions = [
  { value: 'briefing', label: 'Briefing' },
  { value: 'script', label: 'Roteiro' },
  { value: 'report', label: 'Relatorio' },
  { value: 'note', label: 'Nota interna' },
] as const;

export const documentStatusOptions = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'in_review', label: 'Em revisao' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'archived', label: 'Arquivado' },
] as const;

export const documentTypeLabels: Record<string, string> = Object.fromEntries(
  documentTypeOptions.map((option) => [option.value, option.label]),
);

export const documentStatusLabels: Record<string, string> = Object.fromEntries(
  documentStatusOptions.map((option) => [option.value, option.label]),
);

export function documentStatusTone(status: string) {
  switch (status) {
    case 'approved':
      return 'success' as const;
    case 'in_review':
      return 'warning' as const;
    case 'archived':
      return 'neutral' as const;
    default:
      return 'brand' as const;
  }
}
