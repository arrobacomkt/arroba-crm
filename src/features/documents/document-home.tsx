import { Clock3, FolderArchive, FolderKanban, Plus, Star, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { resolveDocumentIcon } from './document-icon';
import type { WorkspacePageWithContext } from './documents-workspace';

type Group = {
  label: string;
  items: WorkspacePageWithContext[];
};

type DocumentHomeProps = {
  favorites: WorkspacePageWithContext[];
  groupedByAccount: Group[];
  groupedByProject: Group[];
  headline: string;
  pages: WorkspacePageWithContext[];
  recent: WorkspacePageWithContext[];
  subheadline: string;
  templates: Array<{ label: string; onClick: () => void }>;
  onCreatePage: () => void;
  onOpenPage: (documentId: string) => void;
};

export function DocumentHome({
  favorites,
  groupedByAccount,
  groupedByProject,
  headline,
  pages,
  recent,
  subheadline,
  templates,
  onCreatePage,
  onOpenPage,
}: DocumentHomeProps) {
  return (
    <div className="space-y-8 p-6 lg:p-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge tone="brand">Workspace</Badge>
            <div>
              <h1 className="text-2xl font-semibold">{headline}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {subheadline}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onCreatePage}>
              <Plus size={16} />
              Nova pagina
            </Button>
            {templates.map((template) => (
              <Button key={template.label} type="button" variant="secondary" onClick={template.onClick}>
                {template.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Metric label="Paginas neste recorte" value={String(pages.length)} />
        <Metric label="Favoritos" value={String(favorites.length)} icon={<Star size={16} />} />
        <Metric label="Recentes" value={String(recent.length)} icon={<Clock3 size={16} />} />
      </section>

      <WorkspaceSection
        icon={<Clock3 size={18} />}
        items={recent}
        subtitle="As ultimas paginas editadas ou abertas pela equipe."
        title="Recentes"
        onOpenPage={onOpenPage}
      />

      <WorkspaceSection
        icon={<Star size={18} />}
        items={favorites}
        subtitle="Paginas fixadas para acesso rapido."
        title="Favoritos"
        onOpenPage={onOpenPage}
      />

      <GroupedSection
        icon={<UsersRound size={18} />}
        groups={groupedByAccount}
        title="Paginas por cliente"
        onOpenPage={onOpenPage}
      />

      <GroupedSection
        icon={<FolderKanban size={18} />}
        groups={groupedByProject}
        title="Paginas por projeto"
        onOpenPage={onOpenPage}
      />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon ?? <FolderArchive size={16} />}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold data-tabular">{value}</p>
    </div>
  );
}

function WorkspaceSection({
  icon,
  items,
  subtitle,
  title,
  onOpenPage,
}: {
  icon: React.ReactNode;
  items: WorkspacePageWithContext[];
  subtitle: string;
  title: string;
  onOpenPage: (documentId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="text-brand">{icon}</div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {items.map((page) => {
          const Icon = resolveDocumentIcon(page.icon);
          return (
            <button
              key={page.id}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-brand/30 hover:bg-muted/40"
              type="button"
              onClick={() => onOpenPage(page.id)}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon size={15} />
                <span>{page.accountName ?? page.projectTitle ?? 'Pagina livre'}</span>
              </div>
              <p className="mt-3 font-semibold">{page.title}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {page.body.replace(/<[^>]+>/g, ' ').trim() || 'Sem conteudo ainda.'}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GroupedSection({
  icon,
  groups,
  title,
  onOpenPage,
}: {
  icon: React.ReactNode;
  groups: Group[];
  title: string;
  onOpenPage: (documentId: string) => void;
}) {
  const visibleGroups = groups.filter((group) => group.items.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="text-brand">{icon}</div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {visibleGroups.map((group) => (
          <div key={group.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">{group.label}</h3>
              <Badge tone="neutral">{group.items.length}</Badge>
            </div>
            <div className="mt-4 space-y-2">
              {group.items.slice(0, 6).map((page) => (
                <button
                  key={page.id}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted"
                  type="button"
                  onClick={() => onOpenPage(page.id)}
                >
                  <span className="truncate">{page.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {page.projectTitle ?? page.accountName ?? 'Livre'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
