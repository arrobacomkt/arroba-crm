# Arroba Co CRM

CRM operacional e comercial interno da Arroba Co.

## Marco Atual

M6 - Chat interno por canais.

Esta base inclui:

- React + TypeScript + Vite.
- Tailwind CSS v4 e componentes internos inspirados em shadcn/ui.
- React Router, React Query e Supabase client.
- Estrutura modular por dominio.
- Layout base com sidebar, topbar, dashboard inicial e tela de login.
- Supabase local configurado com migrations 001 a 009.
- Migrations de organizacao, perfis, membros, helpers de autorizacao e RLS base.
- Migrations comerciais: contas, contatos, unidades, pipeline, oportunidades, itens de proposta.
- Migrations de servicos e cobranca: service_catalog, client_services, client_service_units, billing_cycles.
- Migrations operacionais: projects, project_tasks.
- Migrations editoriais: documents.
- Migrations de comunicacao: chat_channels, chat_messages.
- RPCs: rpc_convert_opportunity_to_client, rpc_mark_billing_cycle_paid.
- Tela Comercial com indicadores, kanban drag-and-drop e modal de conversao de lead para cliente.
- Tela de Clientes com lista, cards e modal detalhado com abas Geral/Servicos/Faturas.
- Tela de Catalogo de Servicos com criacao de novos servicos.
- Tela de Projetos com cadastro, status, contexto e tarefas por projeto.
- Tela de Tarefas com visao operacional por coluna.
- Tela de Documentos com acervo, filtros, editor e autosave.
- Tela de Chat com canais internos, thread e envio de mensagens.
- Dashboard com metricas de MRR, faturas pendentes, atrasadas e follow-ups.
- ESLint, Oxlint, Prettier, Vitest, Testing Library, Playwright e CI.

## Requisitos

- Node.js 24.
- pnpm via Corepack.
- Supabase CLI para aplicar migrations localmente.

## Ambiente Local

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, a aplicacao mostra uma sessao local apenas para validar navegacao e layout.

## Supabase

```bash
supabase start
supabase db reset
```

O banco deve evoluir exclusivamente por migrations SQL versionadas em `supabase/migrations`.

Migrations implementadas:

```text
001_extensions.sql
002_organizations_profiles.sql
003_security_helpers.sql
004_accounts_contacts_units.sql
005_pipeline_opportunities.sql
006_services_billing.sql
007_projects_tasks.sql
008_documents.sql
009_chat.sql
```

## Comandos

```bash
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm test:e2e
pnpm build
```

## Regras De Implementacao

- Nao expor `service_role` no front-end.
- Nao habilitar cadastro publico no MVP.
- Todas as tabelas expostas devem receber RLS.
- Dados reais so entram apos validacao de producao.
- Operacoes transacionais devem ser implementadas por RPC.
