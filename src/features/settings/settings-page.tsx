import {
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleAlert,
  FolderKanban,
  Globe,
  Link2,
  LockKeyhole,
  MessageSquareText,
  RotateCcw,
  ShieldCheck,
  Target,
  UserRoundCheck,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';

const internalUsers = [
  {
    name: 'Davi',
    role: 'owner',
    scope: 'Estrategia, comercial, atendimento e producao audiovisual',
  },
  {
    name: 'Richards',
    role: 'owner',
    scope: 'Design, edicao, identidade visual e automacoes futuras',
  },
];

const securityChecks = [
  'Cadastro publico desativado no MVP',
  'Perfis criados por trigger a partir de auth.users',
  'RLS inicial habilitado nas tabelas base',
  'Helpers current_org_ids, is_org_member e is_org_owner versionados',
  'Protecao contra remocao do ultimo owner ativo',
];

const moduleStatus = [
  {
    name: 'Dashboard',
    status: 'ready',
    summary: 'Pulso operacional, alertas e atalhos entre modulos.',
  },
  {
    name: 'Leads e pipeline',
    status: 'ready',
    summary: 'Pipeline comercial, follow-ups, conversao e filtros operacionais.',
  },
  {
    name: 'Clientes',
    status: 'ready',
    summary: 'Carteira ativa com leitura de conta, contato e historico convertido.',
  },
  {
    name: 'Projetos e tarefas',
    status: 'ready',
    summary: 'Projetos com tarefas, andamento e filtros de prazo.',
  },
  {
    name: 'Calendario',
    status: 'ready',
    summary: 'Visao de vencimentos, follow-ups e entregas criticas.',
  },
  {
    name: 'Chat',
    status: 'ready',
    summary: 'Canais internos com lembretes operacionais e organizacao por contexto.',
  },
  {
    name: 'Documentos',
    status: 'polish',
    summary: 'Editor com autosave pronto; falta decidir anexos e aprofundamento.',
  },
  {
    name: 'Catalogo de servicos',
    status: 'polish',
    summary: 'Ja lista e cria itens, mas ainda pede edicao, inativacao e refinamentos.',
  },
  {
    name: 'Configuracoes',
    status: 'polish',
    summary: 'Estrutura base pronta; faltava virar um painel mais vivo de operacao.',
  },
];

const closingSteps = [
  {
    title: 'Fechar servicos',
    owner: 'Produto',
    status: 'next',
    summary: 'Editar, inativar e organizar melhor o catalogo.',
  },
  {
    title: 'Fechar configuracoes',
    owner: 'Operacao',
    status: 'now',
    summary: 'Transformar a area em referencia de status, acesso e readiness.',
  },
  {
    title: 'Decidir escopo final de documentos',
    owner: 'Produto',
    status: 'next',
    summary: 'Confirmar se entra anexo, storage e historico de versoes nesta fase.',
  },
  {
    title: 'QA ponta a ponta',
    owner: 'Entrega',
    status: 'pending',
    summary: 'Validar lead -> cliente -> projeto -> tarefa -> calendario -> chat.',
  },
  {
    title: 'Deploy e checklist final',
    owner: 'Entrega',
    status: 'pending',
    summary: 'Ambiente, seguranca, build final e passagem para uso continuo.',
  },
];

const qaStorageKey = 'arrobaco.settings.qaChecklist';
const deployStorageKey = 'arrobaco.settings.deployChecklist';

const qaChecklistSeed = [
  {
    id: 'lead-to-client',
    title: 'Lead vira cliente',
    module: 'Leads / Clientes',
    route: '/app/leads',
    description: 'Criar ou mover oportunidade para ganho e confirmar reflexo na carteira.',
  },
  {
    id: 'client-to-project',
    title: 'Cliente recebe projeto',
    module: 'Clientes / Projetos',
    route: '/app/projetos',
    description: 'Abrir projeto com cliente vinculado e validar leitura no modulo.',
  },
  {
    id: 'project-to-task',
    title: 'Projeto gera tarefa operacional',
    module: 'Projetos / Tarefas',
    route: '/app/tarefas',
    description: 'Criar tarefa, alterar status e validar prazo e prioridade.',
  },
  {
    id: 'calendar-alerts',
    title: 'Calendario reflete prazos',
    module: 'Calendario',
    route: '/app/calendario',
    description: 'Conferir vencimentos, follow-ups e dias criticos visiveis.',
  },
  {
    id: 'chat-reminders',
    title: 'Chat mostra lembretes operacionais',
    module: 'Chat',
    route: '/app/chat',
    description: 'Validar lembretes por canal, filtro rapido e acao de abrir modulo.',
  },
  {
    id: 'documents-workflow',
    title: 'Documentos fluem no dia a dia',
    module: 'Documentos',
    route: '/app/documentos',
    description: 'Criar por template, duplicar, arquivar e revisar autosave.',
  },
] as const;

type QaChecklistItem = (typeof qaChecklistSeed)[number] & {
  note: string;
  status: 'pending' | 'passed' | 'risk';
};

const deployChecklistSeed = [
  {
    id: 'supabase-config',
    title: 'Conexao principal validada',
    description: 'Confirmar URL, chave publica, login e acesso basico no ambiente real.',
  },
  {
    id: 'security-review',
    title: 'Seguranca revisada',
    description: 'Checar RLS, usuarios owners, fluxos protegidos e reset de senha.',
  },
  {
    id: 'build-release',
    title: 'Build de release aprovada',
    description: 'Garantir typecheck, lint, testes e build final sem bloqueios.',
  },
  {
    id: 'critical-flows',
    title: 'Fluxos criticos validados',
    description: 'Passar pelo QA final de comercial, operacao, chat e documentos.',
  },
  {
    id: 'handoff-ops',
    title: 'Operacao pronta para uso continuo',
    description: 'Deixar notas finais, responsaveis e rotina minima de acompanhamento.',
  },
] as const;

type DeployChecklistItem = (typeof deployChecklistSeed)[number] & {
  note: string;
  status: 'pending' | 'ready' | 'risk';
};

function readQaChecklist(): QaChecklistItem[] {
  const seed = qaChecklistSeed.map((item) => ({ ...item, note: '', status: 'pending' as const }));

  if (typeof window === 'undefined') return seed;

  try {
    const raw = window.localStorage.getItem(qaStorageKey);
    if (!raw) return seed;

    const parsed = JSON.parse(raw) as Array<Partial<QaChecklistItem> & { id: string }>;
    const byId = new Map(parsed.map((item) => [item.id, item]));

    return seed.map((item) => {
      const saved = byId.get(item.id);
      return {
        ...item,
        note: typeof saved?.note === 'string' ? saved.note : '',
        status:
          saved?.status === 'passed' || saved?.status === 'risk' || saved?.status === 'pending'
            ? saved.status
            : 'pending',
      };
    });
  } catch {
    return seed;
  }
}

function readDeployChecklist(): DeployChecklistItem[] {
  const seed = deployChecklistSeed.map((item) => ({
    ...item,
    note: '',
    status: 'pending' as const,
  }));

  if (typeof window === 'undefined') return seed;

  try {
    const raw = window.localStorage.getItem(deployStorageKey);
    if (!raw) return seed;

    const parsed = JSON.parse(raw) as Array<Partial<DeployChecklistItem> & { id: string }>;
    const byId = new Map(parsed.map((item) => [item.id, item]));

    return seed.map((item) => {
      const saved = byId.get(item.id);
      return {
        ...item,
        note: typeof saved?.note === 'string' ? saved.note : '',
        status:
          saved?.status === 'ready' || saved?.status === 'risk' || saved?.status === 'pending'
            ? saved.status
            : 'pending',
      };
    });
  } catch {
    return seed;
  }
}

function getModuleTone(status: (typeof moduleStatus)[number]['status']) {
  if (status === 'ready') return 'success' as const;
  return 'warning' as const;
}

function getModuleLabel(status: (typeof moduleStatus)[number]['status']) {
  if (status === 'ready') return 'Pronto';
  return 'Em acabamento';
}

function getStepTone(status: (typeof closingSteps)[number]['status']) {
  if (status === 'now') return 'brand' as const;
  if (status === 'next') return 'warning' as const;
  return 'neutral' as const;
}

function getStepLabel(status: (typeof closingSteps)[number]['status']) {
  if (status === 'now') return 'Em andamento';
  if (status === 'next') return 'Proximo';
  return 'Fila final';
}

function StepIcon({ status }: { status: (typeof closingSteps)[number]['status'] }) {
  if (status === 'now') {
    return <CircleDashed className="text-brand" size={18} />;
  }

  if (status === 'next') {
    return <Circle className="text-warning" size={18} />;
  }

  return <Circle className="text-muted-foreground" size={18} />;
}

export function SettingsPage() {
  const { isSupabaseConfigured } = useAuth();
  const [qaChecklist, setQaChecklist] = useState<QaChecklistItem[]>(() => readQaChecklist());
  const [deployChecklist, setDeployChecklist] = useState<DeployChecklistItem[]>(() =>
    readDeployChecklist(),
  );

  const readyCount = moduleStatus.filter((item) => item.status === 'ready').length;
  const polishCount = moduleStatus.filter((item) => item.status === 'polish').length;
  const completion = Math.round((readyCount / moduleStatus.length) * 100);
  const passedQaCount = qaChecklist.filter((item) => item.status === 'passed').length;
  const qaCompletion = Math.round((passedQaCount / qaChecklist.length) * 100);
  const readyDeployCount = deployChecklist.filter((item) => item.status === 'ready').length;
  const deployCompletion = Math.round((readyDeployCount / deployChecklist.length) * 100);
  const qaRiskCount = qaChecklist.filter((item) => item.status === 'risk').length;
  const deployRiskCount = deployChecklist.filter((item) => item.status === 'risk').length;
  const blockerCount = qaRiskCount + deployRiskCount + polishCount;
  const releaseReadiness =
    blockerCount === 0 && qaCompletion === 100 && deployCompletion === 100
      ? 'ready'
      : blockerCount <= 2 && qaCompletion >= 70
        ? 'attention'
        : 'not_ready';
  const openBlockers = [
    ...moduleStatus
      .filter((item) => item.status === 'polish')
      .map((item) => ({
        id: `module-${item.name}`,
        label: `${item.name}: ${item.summary}`,
      })),
    ...qaChecklist
      .filter((item) => item.status === 'risk')
      .map((item) => ({
        id: `qa-${item.id}`,
        label: `${item.title}: ${item.note || item.description}`,
      })),
    ...deployChecklist
      .filter((item) => item.status === 'risk')
      .map((item) => ({
        id: `deploy-${item.id}`,
        label: `${item.title}: ${item.note || item.description}`,
      })),
  ].slice(0, 6);

  function persistQaChecklist(nextChecklist: QaChecklistItem[]) {
    setQaChecklist(nextChecklist);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(qaStorageKey, JSON.stringify(nextChecklist));
    }
  }

  function updateQaItem(
    itemId: string,
    updater: (current: QaChecklistItem) => QaChecklistItem,
  ) {
    persistQaChecklist(qaChecklist.map((item) => (item.id === itemId ? updater(item) : item)));
  }

  function resetQaChecklist() {
    persistQaChecklist(readQaChecklist().map((item) => ({ ...item, note: '', status: 'pending' })));
  }

  function persistDeployChecklist(nextChecklist: DeployChecklistItem[]) {
    setDeployChecklist(nextChecklist);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(deployStorageKey, JSON.stringify(nextChecklist));
    }
  }

  function updateDeployItem(
    itemId: string,
    updater: (current: DeployChecklistItem) => DeployChecklistItem,
  ) {
    persistDeployChecklist(
      deployChecklist.map((item) => (item.id === itemId ? updater(item) : item)),
    );
  }

  function resetDeployChecklist() {
    persistDeployChecklist(
      readDeployChecklist().map((item) => ({ ...item, note: '', status: 'pending' })),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuracoes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organizacao, seguranca e leitura clara do que falta para encerrar o CRM.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">Painel temporario de entrega</Badge>
          <Badge tone={isSupabaseConfigured ? 'success' : 'warning'}>
            {isSupabaseConfigured ? 'Supabase conectado' : 'Modo local'}
          </Badge>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<FolderKanban size={20} />}
          label="Modulos prontos"
          value={`${readyCount}/${moduleStatus.length}`}
          tone="success"
        />
        <MetricCard
          icon={<Wrench size={20} />}
          label="Em acabamento"
          value={String(polishCount)}
          tone="warning"
        />
        <MetricCard
          icon={<Target size={20} />}
          label="Fechamento visual"
          value={`${completion}%`}
          tone="brand"
        />
        <MetricCard
          icon={<LockKeyhole size={20} />}
          label="Base"
          value={isSupabaseConfigured ? 'Conectada' : 'Local'}
          tone={isSupabaseConfigured ? 'success' : 'warning'}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Pronto para liberar?</h2>
                <p className="text-sm text-muted-foreground">
                  Leitura executiva do estado atual de fechamento do projeto.
                </p>
              </div>
              <Badge
                tone={
                  releaseReadiness === 'ready'
                    ? 'success'
                    : releaseReadiness === 'attention'
                      ? 'warning'
                      : 'danger'
                }
              >
                {releaseReadiness === 'ready'
                  ? 'Pronto'
                  : releaseReadiness === 'attention'
                    ? 'Quase la'
                    : 'Ainda nao'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryPill label="QA final" value={`${qaCompletion}%`} />
              <SummaryPill label="Deploy final" value={`${deployCompletion}%`} />
              <SummaryPill label="Bloqueios" value={String(blockerCount)} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {releaseReadiness === 'ready'
                ? 'O CRM esta com os fluxos principais validados e sem pendencias relevantes visiveis nesta rodada.'
                : releaseReadiness === 'attention'
                  ? 'O projeto ja esta bem encaminhado para liberacao, mas ainda vale revisar alguns pontos antes de encerrar.'
                  : 'Ainda existem pendencias de acabamento ou pontos de atencao que pedem uma ultima passada antes da liberacao.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
                <CircleAlert size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Pendencias ativas</h2>
                <p className="text-sm text-muted-foreground">
                  O que ainda merece atencao antes de considerar o fechamento concluido.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {openBlockers.length > 0 ? (
              <div className="space-y-3">
                {openBlockers.map((item) => (
                  <div key={item.id} className="rounded-md border border-border p-3 text-sm">
                    {item.label}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Sem pendencias abertas nesta leitura. O painel esta limpo para liberacao.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">QA de fechamento</h2>
              <p className="text-sm text-muted-foreground">
                Checklist pratico para validar os fluxos finais do CRM sem se perder.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={qaCompletion === 100 ? 'success' : 'brand'}>
                {passedQaCount}/{qaChecklist.length} aprovado(s)
              </Badge>
              <Badge tone="neutral">{qaCompletion}% concluido</Badge>
              <Button type="button" variant="ghost" onClick={resetQaChecklist}>
                <RotateCcw size={16} />
                Resetar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {qaChecklist.map((item) => (
              <article key={item.id} className="rounded-md border border-border p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.title}</p>
                        <Badge tone="neutral">{item.module}</Badge>
                        <Badge
                          tone={
                            item.status === 'passed'
                              ? 'success'
                              : item.status === 'risk'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {item.status === 'passed'
                            ? 'Aprovado'
                            : item.status === 'risk'
                              ? 'Atencao'
                              : 'Pendente'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <a
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                      href={item.route}
                    >
                      <Link2 size={16} />
                      Abrir fluxo
                    </a>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={item.status === 'passed' ? 'success' : 'secondary'}
                      onClick={() =>
                        updateQaItem(item.id, (current) => ({ ...current, status: 'passed' }))
                      }
                    >
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant={item.status === 'risk' ? 'danger' : 'ghost'}
                      onClick={() =>
                        updateQaItem(item.id, (current) => ({ ...current, status: 'risk' }))
                      }
                    >
                      Marcar atencao
                    </Button>
                    <Button
                      type="button"
                      variant={item.status === 'pending' ? 'secondary' : 'ghost'}
                      onClick={() =>
                        updateQaItem(item.id, (current) => ({ ...current, status: 'pending' }))
                      }
                    >
                      Voltar para pendente
                    </Button>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Observacoes
                    </span>
                    <Input
                      placeholder="Ex: fluxo ok, mas revisar prazo no calendario."
                      value={item.note}
                      onChange={(event) =>
                        updateQaItem(item.id, (current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Deploy e operacao</h2>
              <p className="text-sm text-muted-foreground">
                Checklist final para publicar, entregar e acompanhar o CRM com tranquilidade.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={deployCompletion === 100 ? 'success' : 'brand'}>
                {readyDeployCount}/{deployChecklist.length} pronto(s)
              </Badge>
              <Badge tone="neutral">{deployCompletion}% concluido</Badge>
              <Button type="button" variant="ghost" onClick={resetDeployChecklist}>
                <RotateCcw size={16} />
                Resetar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {deployChecklist.map((item) => (
              <article key={item.id} className="rounded-md border border-border p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.title}</p>
                        <Badge
                          tone={
                            item.status === 'ready'
                              ? 'success'
                              : item.status === 'risk'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {item.status === 'ready'
                            ? 'Pronto'
                            : item.status === 'risk'
                              ? 'Atencao'
                              : 'Pendente'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
                      <Globe size={18} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={item.status === 'ready' ? 'success' : 'secondary'}
                      onClick={() =>
                        updateDeployItem(item.id, (current) => ({ ...current, status: 'ready' }))
                      }
                    >
                      Marcar pronto
                    </Button>
                    <Button
                      type="button"
                      variant={item.status === 'risk' ? 'danger' : 'ghost'}
                      onClick={() =>
                        updateDeployItem(item.id, (current) => ({ ...current, status: 'risk' }))
                      }
                    >
                      Marcar atencao
                    </Button>
                    <Button
                      type="button"
                      variant={item.status === 'pending' ? 'secondary' : 'ghost'}
                      onClick={() =>
                        updateDeployItem(item.id, (current) => ({ ...current, status: 'pending' }))
                      }
                    >
                      Voltar para pendente
                    </Button>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Observacoes
                    </span>
                    <Input
                      placeholder="Ex: falta validar reset de senha em producao."
                      value={item.note}
                      onChange={(event) =>
                        updateDeployItem(item.id, (current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Organizacao</h2>
                <p className="text-sm text-muted-foreground">Workspace unico do MVP</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <dt className="text-muted-foreground">Nome</dt>
                <dd className="font-semibold">Arroba Co</dd>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <dt className="text-muted-foreground">Slug</dt>
                <dd className="font-mono text-xs font-semibold">arroba-co</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Timezone</dt>
                <dd className="font-mono text-xs font-semibold">America/Sao_Paulo</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
                <UsersRound size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Usuarios internos</h2>
                <p className="text-sm text-muted-foreground">Ambos seguem como owners no MVP</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {internalUsers.map((user) => (
                <article key={user.name} className="rounded-md border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-brand">
                        <UserRoundCheck size={18} />
                      </div>
                      <h3 className="font-semibold">{user.name}</h3>
                    </div>
                    <Badge tone="brand">{user.role}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{user.scope}</p>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Status dos modulos</h2>
                <p className="text-sm text-muted-foreground">
                  Leitura visual do que ja opera bem e do que ainda pede acabamento.
                </p>
              </div>
              <Badge tone="brand">{completion}% concluido</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {moduleStatus.map((item) => (
                <article key={item.name} className="rounded-md border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.summary}
                      </p>
                    </div>
                    <Badge tone={getModuleTone(item.status)}>{getModuleLabel(item.status)}</Badge>
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
                <MessageSquareText size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Proximos passos</h2>
                <p className="text-sm text-muted-foreground">
                  Ordem sugerida para levar o projeto ao fechamento.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {closingSteps.map((step) => (
                <article key={step.title} className="rounded-md border border-border p-4">
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <StepIcon status={step.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{step.title}</p>
                        <Badge tone={getStepTone(step.status)}>{getStepLabel(step.status)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{step.summary}</p>
                      <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">
                        Frente: {step.owner}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Checklist M1</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {securityChecks.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
                <CheckCircle2 className="shrink-0 text-success" size={18} />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'brand';
};

function MetricCard({ icon, label, value, tone }: MetricCardProps) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-brand';

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold data-tabular">{value}</p>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-md bg-muted ${toneClass}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold data-tabular">{value}</p>
    </div>
  );
}
