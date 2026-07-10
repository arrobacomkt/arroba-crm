import type { ModuleTab } from '@/components/layout/module-tabs';

export const commercialTabs: ModuleTab[] = [
  { label: 'Pipeline', to: '/app/comercial/pipeline' },
  { label: 'Leads', to: '/app/comercial/leads' },
  { label: 'Oportunidades', to: '/app/comercial/oportunidades' },
  { label: 'Follow-ups', to: '/app/comercial/follow-ups' },
  { label: 'Propostas', to: '/app/comercial/propostas' },
  { label: 'Perdidos', to: '/app/comercial/perdidos' },
];

export const clientTabs: ModuleTab[] = [
  { label: 'Ativos', to: '/app/clientes/ativos' },
  { label: 'Onboarding', to: '/app/clientes/onboarding' },
  { label: 'Pausados', to: '/app/clientes/pausados' },
  { label: 'Encerrados', to: '/app/clientes/encerrados' },
];

export const serviceTabs: ModuleTab[] = [
  { label: 'Contratados', to: '/app/servicos/contratados' },
  { label: 'Catalogo', to: '/app/servicos/catalogo' },
  { label: 'Cobrancas', to: '/app/servicos/cobrancas' },
  { label: 'Renovacoes', to: '/app/servicos/renovacoes' },
  { label: 'Upgrades', to: '/app/servicos/upgrades' },
];

export const projectTabs: ModuleTab[] = [
  { label: 'Ativos', to: '/app/projetos/ativos' },
  { label: 'Ciclos mensais', to: '/app/projetos/ciclos-mensais' },
  { label: 'Avulsos', to: '/app/projetos/avulsos' },
  { label: 'Onboarding', to: '/app/projetos/onboarding' },
  { label: 'Aprovacao', to: '/app/projetos/aprovacao' },
  { label: 'Concluidos', to: '/app/projetos/concluidos' },
];

export const taskTabs: ModuleTab[] = [
  { label: 'Lista', to: '/app/tarefas/lista' },
  { label: 'Kanban', to: '/app/tarefas/kanban' },
  { label: 'Calendario', to: '/app/tarefas/calendario' },
  { label: 'Minhas', to: '/app/tarefas/minhas' },
  { label: 'Atrasadas', to: '/app/tarefas/atrasadas' },
];

export const documentTabs: ModuleTab[] = [
  { label: 'Todos', to: '/app/documentos/todos' },
  { label: 'Briefings', to: '/app/documentos/briefings' },
  { label: 'Roteiros', to: '/app/documentos/roteiros' },
  { label: 'Calendarios', to: '/app/documentos/calendarios' },
  { label: 'Relatorios', to: '/app/documentos/relatorios' },
  { label: 'Guias de marca', to: '/app/documentos/guias-de-marca' },
  { label: 'Arquivados', to: '/app/documentos/arquivados' },
];

export const chatTabs: ModuleTab[] = [
  { label: 'Gerais', to: '/app/chat/gerais' },
  { label: 'Clientes', to: '/app/chat/clientes' },
  { label: 'Projetos', to: '/app/chat/projetos' },
  { label: 'Leads', to: '/app/chat/leads' },
  { label: 'Arquivados', to: '/app/chat/arquivados' },
];

export const settingsTabs: ModuleTab[] = [
  { label: 'Geral', to: '/app/configuracoes/geral' },
  { label: 'Usuarios', to: '/app/configuracoes/usuarios' },
  { label: 'Pipeline', to: '/app/configuracoes/pipeline' },
  { label: 'Catalogo de servicos', to: '/app/configuracoes/catalogo-servicos' },
  { label: 'Modelos', to: '/app/configuracoes/modelos' },
  { label: 'Seguranca', to: '/app/configuracoes/seguranca' },
  { label: 'Aparencia', to: '/app/configuracoes/aparencia' },
  { label: 'Sistema', to: '/app/configuracoes/sistema' },
];
