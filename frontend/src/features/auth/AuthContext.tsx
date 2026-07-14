import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, getToken, setToken, setStoredRole, type Me } from '@/api/client';

interface AuthContextValue {
  me: Me | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, role: string) => void;
  logout: () => void;
  refetchMe: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState(getToken());

  const { data: me, isLoading, refetch } = useQuery({
    queryKey: ['me', token],
    queryFn: () => api.get<Me>('/me'),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (token && me) setStoredRole(me.role);
  }, [token, me]);

  const login = (newToken: string, role: string) => {
    setToken(newToken);
    setStoredRole(role);
    setTokenState(newToken);
  };

  const logout = () => {
    setToken(null);
    setStoredRole(null);
    setTokenState(null);
  };

  return (
    <AuthContext.Provider
      value={{
        me: me ?? null,
        isLoading: !!token && isLoading,
        isAuthenticated: !!token && !!me,
        login,
        logout,
        refetchMe: () => { void refetch(); },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
