import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AppRouter } from '@/app/router';
import { AuthProvider } from '@/features/auth/AuthContext';
import { appTheme } from '@/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={appTheme} locale={viVN}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
