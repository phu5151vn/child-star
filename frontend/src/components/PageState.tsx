import { Button, Empty, Result, Skeleton, Spin } from 'antd';
import type { ReactNode } from 'react';

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
  emptyDescription = 'Chưa có dữ liệu',
  onRetry,
  children,
  skeletonRows = 4,
}: PageStateProps) {
  if (isLoading) {
    return <Skeleton active paragraph={{ rows: skeletonRows }} />;
  }
  if (isError) {
    return (
      <Result
        status="error"
        title="Có lỗi xảy ra"
        subTitle={errorMessage ?? 'Vui lòng thử lại sau'}
        extra={onRetry && <Button onClick={onRetry}>Thử lại</Button>}
      />
    );
  }
  if (isEmpty) {
    return <Empty description={emptyDescription} />;
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
