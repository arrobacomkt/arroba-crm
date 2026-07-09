import { ShieldCheck, UserRoundCheck, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';

const internalUsers = [
  {
    name: 'Davi',
    role: 'owner',
    scope: 'Estratégia, comercial, atendimento e produção audiovisual',
  },
  {
    name: 'Richards',
    role: 'owner',
    scope: 'Design, edição, identidade visual e automações futuras',
  },
];

const securityChecks = [
  'Cadastro público desativado no MVP',
  'Perfis criados por trigger a partir de auth.users',
  'RLS inicial habilitado nas tabelas base',
  'Helpers current_org_ids, is_org_member e is_org_owner versionados',
  'Proteção contra remoção do último owner ativo',
];

export function SettingsPage() {
  const { isSupabaseConfigured } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organização, usuários internos e segurança de base.
          </p>
        </div>
        <Badge tone={isSupabaseConfigured ? 'success' : 'warning'}>
          {isSupabaseConfigured ? 'Supabase conectado' : 'Modo local'}
        </Badge>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Organização</h2>
                <p className="text-sm text-muted-foreground">Workspace único do MVP</p>
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
                <h2 className="font-semibold">Usuários internos</h2>
                <p className="text-sm text-muted-foreground">Ambos são owners no MVP</p>
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
                <ShieldCheck className="shrink-0 text-success" size={18} />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
