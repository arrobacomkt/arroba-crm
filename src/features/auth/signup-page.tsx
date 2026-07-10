import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useAuth } from './auth-context';

const signUpSchema = z.object({
  fullName: z.string().min(3, 'Informe seu nome completo.'),
  email: z.string().email('Informe um e-mail valido.'),
  password: z
    .string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
    .regex(/[A-Z]/, 'Use pelo menos uma letra maiuscula.')
    .regex(/[0-9]/, 'Use pelo menos um numero.'),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignupPage() {
  const { user, signUpWithPassword } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
  });

  if (user) {
    return <Navigate replace to="/workspaces" />;
  }

  async function onSubmit(values: SignUpValues) {
    setIsSubmitting(true);
    try {
      await signUpWithPassword(values.email, values.password, values.fullName);
      toast.success('Conta criada. Agora voce ja pode entrar no fluxo de workspaces.');
      navigate('/workspaces', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel criar a conta.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-background lg:grid-cols-[1fr_460px]">
      <section className="hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-sm text-sidebar-muted">Arroba CRM</p>
            <h1 className="text-2xl font-bold">Criar conta</h1>
          </div>
        </div>

        <div className="max-w-2xl space-y-5">
          <p className="text-sm font-semibold uppercase text-sidebar-muted">SPEC-004</p>
          <h2 className="text-4xl font-bold leading-tight">
            Um mesmo usuario pode circular por varios workspaces com seguranca.
          </h2>
          <p className="max-w-xl text-base leading-7 text-sidebar-muted">
            Essa camada abre o CRM para cadastro proprio, convites, selecao de workspace e identidade visual inicial.
          </p>
        </div>

        <p className="text-sm text-sidebar-muted">America/Sao_Paulo · autenticacao por e-mail e senha</p>
      </section>

      <section className="flex items-center justify-center p-5">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-brand">
                <UserRound size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Criar sua conta</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Depois do cadastro, a entrada passa a acontecer pela tela de workspaces.
                </p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">Nome completo</span>
                <Input autoComplete="name" {...form.register('fullName')} />
                {form.formState.errors.fullName ? (
                  <span className="text-xs font-medium text-danger">{form.formState.errors.fullName.message}</span>
                ) : null}
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">E-mail</span>
                <Input autoComplete="email" type="email" {...form.register('email')} />
                {form.formState.errors.email ? (
                  <span className="text-xs font-medium text-danger">{form.formState.errors.email.message}</span>
                ) : null}
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">Senha</span>
                <Input autoComplete="new-password" type="password" {...form.register('password')} />
                {form.formState.errors.password ? (
                  <span className="text-xs font-medium text-danger">{form.formState.errors.password.message}</span>
                ) : null}
              </label>

              <Button className="w-full" disabled={isSubmitting} type="submit">
                Criar conta
                <ArrowRight size={18} />
              </Button>
            </form>

            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 text-brand" size={18} />
                <p>
                  Se a confirmacao de e-mail estiver habilitada no Supabase, voce finaliza a conta pelo link enviado para o e-mail informado.
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Ja possui conta?{' '}
              <Link className="font-semibold text-brand" to="/login">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
