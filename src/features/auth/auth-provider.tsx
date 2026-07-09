import type { User } from '@supabase/supabase-js';
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';

import { supabase, supabaseMode } from '@/integrations/supabase/client';

import { AuthContext, type AuthContextValue, type CurrentUser } from './auth-context';

const LOCAL_USER: CurrentUser = {
  id: 'local-richards',
  fullName: 'Richards',
  email: 'richards@arrobaco.local',
  role: 'owner',
};

function mapUser(user: User): CurrentUser {
  return {
    id: user.id,
    fullName: user.user_metadata.full_name ?? user.email ?? 'Usuário Arroba Co',
    email: user.email ?? '',
    role: 'owner',
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [forceLocal, setForceLocalState] = useState(
    () => window.localStorage.getItem('arrobaco.forceLocal') === 'true',
  );
  const [user, setUser] = useState<CurrentUser | null>(() => {
    if (supabaseMode === 'configured' && !forceLocal) return null;
    return window.localStorage.getItem('arrobaco.localSession') === 'true' ? LOCAL_USER : null;
  });
  const [isLoading, setIsLoading] = useState(Boolean(supabase) && !forceLocal);

  function setForceLocal(value: boolean) {
    window.localStorage.setItem('arrobaco.forceLocal', String(value));
    setForceLocalState(value);
    if (value) {
      setUser(LOCAL_USER);
    } else {
      window.location.reload();
    }
  }

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let isMounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.user ? mapUser(data.user) : null);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapUser(session.user) : null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isSupabaseConfigured: Boolean(supabase) && !forceLocal,
      forceLocal,
      setForceLocal,
      signInWithPassword: async (email, password) => {
        if (!supabase) {
          window.localStorage.setItem('arrobaco.localSession', 'true');
          setUser({ ...LOCAL_USER, email });
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      requestPasswordReset: async (email) => {
        if (!supabase) {
          throw new Error('Supabase not configured');
        }

        const redirectTo = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (error) throw error;
      },
      updatePassword: async (password) => {
        if (!supabase) {
          throw new Error('Supabase not configured');
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
      signInLocal: () => {
        window.localStorage.setItem('arrobaco.localSession', 'true');
        setUser(LOCAL_USER);
      },
      signOut: async () => {
        window.localStorage.removeItem('arrobaco.localSession');
        window.localStorage.removeItem('arrobaco.forceLocal');
        if (supabase) {
          await supabase.auth.signOut();
        }
        setForceLocal(false);
        setUser(null);
      },
    }),
    [isLoading, user, forceLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
