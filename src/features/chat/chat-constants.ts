export const chatScopeOptions = [
  { value: 'general', label: 'Geral' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'operations', label: 'Operacao' },
  { value: 'client', label: 'Cliente' },
] as const;

export const chatScopeLabels: Record<string, string> = Object.fromEntries(
  chatScopeOptions.map((option) => [option.value, option.label]),
);

export function chatScopeTone(scope: string) {
  switch (scope) {
    case 'commercial':
      return 'warning' as const;
    case 'operations':
      return 'brand' as const;
    case 'client':
      return 'success' as const;
    default:
      return 'neutral' as const;
  }
}
