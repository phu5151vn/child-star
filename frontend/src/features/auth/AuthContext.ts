import { createContext, useContext } from 'react';
import type { Me } from '@/api/client';

export interface AuthContextValue {
  me: Me | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, role: string) => void;
  logout: () => void;
  refetchMe: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
