import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
import { AppRouter } from '@/app/router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { appTheme } from '@/theme/tokens';
import '@/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cân bằng giữa đồng bộ và tiết kiệm request:
      // - staleTime 30s: trong 30s coi dữ liệu là mới, chuyển qua lại giữa các trang không gọi lại API.
      // - refetchOnMount 'always' -> mặc định (chỉ refetch khi đã cũ) để không gọi lặp liên tục.
      // - Tắt refetch khi focus lại tab (nguyên nhân chính gây spam request).
      // - Vẫn refetch khi có mạng lại; các thao tác quan trọng tự cập nhật cache cục bộ (xem mutation).
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Backend Render (gói free) có thể "ngủ" và request đầu bị lỗi/timeout khi vừa thức dậy.
      // Retry vài lần với backoff giúp trang tự phục hồi thay vì báo "lỗi tải dữ liệu".
      retry: 3,
      retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 12_000),
    },
  },
});

export function App() {
  // Locale của Ant Design (định dạng ngày, text mặc định của component) bám theo ngôn ngữ i18n.
  const { i18n } = useTranslation();
  const antdLocale = i18n.language === 'en' ? enUS : viVN;

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={appTheme} locale={antdLocale}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
