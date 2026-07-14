import { Card, Col, Row, Statistic, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api, type Assignment, type Redemption } from '@/api/client';
import { PageState } from '@/components/PageState';

const { Title } = Typography;

export function ParentDashboardPage() {
  const { data: submitted, isLoading: l1, isError: e1, refetch: r1 } = useQuery({
    queryKey: ['assignments', 'submitted'],
    queryFn: () => api.get<Assignment[]>('/assignments?status=submitted'),
  });
  const { data: requested, isLoading: l2, isError: e2, refetch: r2 } = useQuery({
    queryKey: ['redemptions', 'requested'],
    queryFn: () => api.get<Redemption[]>('/redemptions?status=requested'),
  });
  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.get<{ family_code: string }>('/family'),
  });

  return (
    <PageState
      isLoading={l1 || l2}
      isError={e1 || e2}
      onRetry={() => { void r1(); void r2(); }}
    >
      <Title level={3}>Tổng quan gia đình</Title>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Chờ duyệt hoàn thành" value={submitted?.length ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Chờ duyệt đổi thưởng" value={requested?.length ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Mã gia đình" value={family?.family_code ?? '—'} />
          </Card>
        </Col>
      </Row>
    </PageState>
  );
}
