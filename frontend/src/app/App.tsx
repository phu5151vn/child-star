import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AppRouter } from '@/app/router';
import { AuthProvider } from '@/features/auth/AuthContext';
import { appTheme } from '@/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Ưu tiên đồng bộ: luôn lấy dữ liệu mới khi mở lại trang, quay lại tab hoặc có mạng lại.
      // Nhờ vậy trạng thái nhiệm vụ/đổi thưởng không bị "kẹt" ở giá trị cũ giữa các thiết bị.
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
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
