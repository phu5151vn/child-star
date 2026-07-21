import { Button, Empty, Result, Skeleton, Spin } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface PageStateProps {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  errorMessage?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  children: ReactNode;
  skeletonRows?: number;
}

export function PageState({
  isLoading,
  isError,
  isEmpty,
  errorMessage,
  emptyDescription,
  onRetry,
  children,
  skeletonRows = 4,
}: PageStateProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return <Skeleton active paragraph={{ rows: skeletonRows }} />;
  }
  if (isError) {
    return (
      <Result
        status="error"
        title={t('state.error')}
        subTitle={errorMessage ?? t('components:pageState.errorSubtitle')}
        extra={onRetry && <Button onClick={onRetry}>{t('state.retry')}</Button>}
      />
    );
  }
  if (isEmpty) {
    return <Empty description={emptyDescription ?? t('state.empty')} />;
  }
  return <>{children}</>;
}

export function LoadingSpin() {
  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <Spin size="large" />
    </div>
  );
}
