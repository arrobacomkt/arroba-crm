import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useAuth } from './auth-context';

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme a nova senha.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'As senhas precisam ser iguais.',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const { user, updatePassword, isSupabaseConfigured, forceLocal } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const navigate = useNavigate();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  if (forceLocal) {
    return <Navigate to="/login" replace />;
  }

  async function onSubmit(values: ResetPasswordFormValues) {
    setIsSubmitting(true);
    try {
      await updatePassword(values.password);
      setIsComplete(true);
      toast.success('Senha atualizada com sucesso.');
    } catch {
      toast.error('Nao foi possivel atualizar a senha. Abra novamente o link do e-mail.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-5">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-brand">
              {isComplete ? <CheckCircle2 size={22} /> : <KeyRound size={22} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Definir nova senha</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {isComplete
                  ? 'Sua senha foi atualizada. Agora voce ja pode entrar normalmente no CRM.'
                  : 'Use o link enviado por e-mail para criar uma nova senha de acesso.'}
              </p>
            </div>
          </div>

          {!isSupabaseConfigured ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              A recuperacao de senha depende do Supabase configurado neste ambiente.
            </div>
          ) : null}

          {isComplete ? (
            <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
              Ir para login
              <ArrowRight size={18} />
            </Button>
          ) : (
            <>
              {!user ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                  Abra esta tela a partir do link de recuperacao enviado por e-mail para autorizar a
                  troca de senha.
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-foreground">Nova senha</span>
                  <Input
                    autoComplete="new-password"
                    type="password"
                    {...form.register('password')}
                  />
                  {form.formState.errors.password ? (
                    <span className="text-xs font-medium text-danger">
                      {form.formState.errors.password.message}
                    </span>
                  ) : null}
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-foreground">
                    Confirmar nova senha
                  </span>
                  <Input
                    autoComplete="new-password"
                    type="password"
                    {...form.register('confirmPassword')}
                  />
                  {form.formState.errors.confirmPassword ? (
                    <span className="text-xs font-medium text-danger">
                      {form.formState.errors.confirmPassword.message}
                    </span>
                  ) : null}
                </label>

                <Button
                  className="w-full"
                  disabled={isSubmitting || !user || !isSupabaseConfigured}
                  type="submit"
                >
                  Atualizar senha
                  <ArrowRight size={18} />
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
