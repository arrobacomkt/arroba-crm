import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2, LockKeyhole, Mail, ServerOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useAuth } from './auth-context';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const passwordResetSchema = z.object({
  email: z.string().email('Informe um e-mail valido.'),
});

type PasswordResetFormValues = z.infer<typeof passwordResetSchema>;

export function LoginPage() {
  const {
    user,
    signInWithPassword,
    requestPasswordReset,
    signInLocal,
    isSupabaseConfigured,
    forceLocal,
    setForceLocal,
  } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forcingLocal, setForcingLocal] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const canUseLocalSession = import.meta.env.DEV;
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/workspaces';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const resetForm = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      email: '',
    },
  });

  if (user && !forceLocal) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(values: LoginFormValues) {
    setIsSubmitting(true);
    try {
      await signInWithPassword(values.email, values.password);
      navigate(from, { replace: true });
    } catch {
      toast.error('Não foi possível entrar. Revise e-mail e senha.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onRequestPasswordReset(values: PasswordResetFormValues) {
    setIsSendingReset(true);
    try {
      await requestPasswordReset(values.email);
      toast.success('Enviamos o link de recuperacao para o e-mail informado.');
      setShowResetForm(false);
      resetForm.reset({ email: values.email });
    } catch {
      toast.error('Nao foi possivel enviar o link de recuperacao.');
    } finally {
      setIsSendingReset(false);
    }
  }

  function enterLocalMode() {
    signInLocal();
    navigate(from, { replace: true });
  }

  async function enterForcedLocalMode() {
    setForcingLocal(true);
    setForceLocal(true);
    navigate(from, { replace: true });
  }

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-background lg:grid-cols-[1fr_460px]">
      <section className="hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-sm text-sidebar-muted">Arroba Co</p>
            <h1 className="text-2xl font-bold">CRM Operacional</h1>
          </div>
        </div>

        <div className="max-w-2xl space-y-5">
          <p className="text-sm font-semibold uppercase text-sidebar-muted">MVP interno</p>
          <h2 className="text-4xl font-bold leading-tight">
            Comercial, produção e contexto em um só lugar.
          </h2>
          <p className="max-w-xl text-base leading-7 text-sidebar-muted">
            Base privada para Davi e Richards acompanharem leads, clientes, serviços, projetos,
            tarefas, documentos e decisões internas.
          </p>
        </div>

        <p className="text-sm text-sidebar-muted">America/Sao_Paulo · dados protegidos por RLS</p>
      </section>

      <section className="flex items-center justify-center p-5">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-brand">
                <LockKeyhole size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Entrar no CRM</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Entre para escolher um workspace e seguir para a operacao.
                </p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">E-mail</span>
                <Input autoComplete="email" type="email" {...form.register('email')} />
                {form.formState.errors.email ? (
                  <span className="text-xs font-medium text-danger">
                    {form.formState.errors.email.message}
                  </span>
                ) : null}
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">Senha</span>
                <Input
                  autoComplete="current-password"
                  type="password"
                  {...form.register('password')}
                />
                {form.formState.errors.password ? (
                  <span className="text-xs font-medium text-danger">
                    {form.formState.errors.password.message}
                  </span>
                ) : null}
              </label>

              <button
                className="text-sm font-medium text-brand transition hover:text-brand/80"
                type="button"
                onClick={() => {
                  setShowResetForm((current) => !current);
                  resetForm.reset({ email: form.getValues('email') });
                }}
              >
                Esqueci minha senha
              </button>

              <Button className="w-full" disabled={isSubmitting} type="submit">
                Entrar
                <ArrowRight size={18} />
              </Button>
            </form>

            {showResetForm ? (
              <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-background text-brand">
                    <Mail size={18} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">Recuperar acesso</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Enviamos um link para redefinir a senha do usuario informado.
                    </p>
                  </div>
                </div>

                <form
                  className="space-y-3"
                  onSubmit={resetForm.handleSubmit(onRequestPasswordReset)}
                >
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-foreground">E-mail</span>
                    <Input autoComplete="email" type="email" {...resetForm.register('email')} />
                    {resetForm.formState.errors.email ? (
                      <span className="text-xs font-medium text-danger">
                        {resetForm.formState.errors.email.message}
                      </span>
                    ) : null}
                  </label>

                  <Button
                    className="w-full"
                    disabled={isSendingReset || !isSupabaseConfigured}
                    type="submit"
                    variant="secondary"
                  >
                    Enviar link de recuperacao
                    <ArrowRight size={18} />
                  </Button>
                </form>
              </div>
            ) : null}

            {forceLocal ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                <span className="font-semibold">Modo local forçado.</span> Os dados são fictícios e
                não persistem. Saia para voltar ao login normal.
              </div>
            ) : null}

            {!isSupabaseConfigured && !forceLocal ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                Supabase ainda não está configurado neste ambiente. Use a sessão local apenas para
                validar layout e navegação do M0.
              </div>
            ) : null}

            {canUseLocalSession && !forceLocal ? (
              <div className="space-y-2">
                <Button
                  className="w-full"
                  type="button"
                  variant="secondary"
                  onClick={enterLocalMode}
                >
                  Entrar em modo local
                </Button>
                {isSupabaseConfigured ? (
                  <Button
                    className="w-full"
                    type="button"
                    variant="ghost"
                    disabled={forcingLocal}
                    onClick={enterForcedLocalMode}
                  >
                    {forcingLocal ? (
                      <Loader2 className="animate-spin mr-2" size={16} />
                    ) : (
                      <ServerOff className="mr-2" size={16} />
                    )}
                    Forçar modo local (ignorar Supabase)
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="border-t border-border pt-4 text-sm text-muted-foreground">
              Ainda nao possui conta?{' '}
              <Link className="font-semibold text-brand" to="/cadastro">
                Criar conta
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
