import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken, setStoredRole, type Me } from '@/api/client';
import { AuthContext } from '@/features/auth/AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
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
    // Xóa toàn bộ cache của phiên trước để không đọc nhầm trạng thái nhiệm vụ/phần thưởng cũ.
    queryClient.clear();
    setToken(newToken);
    setStoredRole(role);
    setTokenState(newToken);
  };

  const logout = () => {
    setToken(null);
    setStoredRole(null);
    setTokenState(null);
    // Hủy request đang chạy và dọn cache để phiên sau luôn fetch dữ liệu mới.
    void queryClient.cancelQueries();
    queryClient.clear();
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
