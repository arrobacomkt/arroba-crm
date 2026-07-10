import { createContext, useContext } from 'react';

export type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
};

export type AuthContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  isSupabaseConfigured: boolean;
  forceLocal: boolean;
  setForceLocal: (value: boolean) => void;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signInLocal: () => void;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
