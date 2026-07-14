import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Card, List, Space, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError, type Assignment } from '@/api/client';
import { celebratePoints } from '@/components/CelebrationFx';
import { PageState } from '@/components/PageState';

const { Title, Text } = Typography;

export function ParentApprovalsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['assignments', 'submitted'],
    queryFn: () => api.get<Assignment[]>('/assignments?status=submitted'),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/assignments/${id}/approve`),
    onSuccess: (_d, id) => {
      const item = data?.find((a) => a.id === id);
      message.success(`Đã duyệt! +${item?.task_points ?? 0} sao`);
      celebratePoints();
      void qc.invalidateQueries({ queryKey: ['assignments'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.post(`/assignments/${id}/reject`, { reason: 'Cần làm lại nhé!' }),
    onSuccess: () => {
      message.info('Đã từ chối');
      void qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });

  return (
    <>
      <Title level={3}>Duyệt hoàn thành nhiệm vụ</Title>
      <PageState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data?.length}
        onRetry={refetch}
        emptyDescription="Không có nhiệm vụ chờ duyệt"
      >
        <List
          dataSource={data}
          renderItem={(item) => (
            <List.Item>
              <Card style={{ width: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>{item.child_name}</Text>
                  <Text>{item.task_title} — +{item.task_points} sao</Text>
                  <Space>
                    <Button type="primary" icon={<CheckOutlined />} onClick={() => approveMut.mutate(item.id)}>
                      Duyệt
                    </Button>
                    <Button danger icon={<CloseOutlined />} onClick={() => rejectMut.mutate(item.id)}>
                      Từ chối
                    </Button>
                  </Space>
                </Space>
              </Card>
            </List.Item>
          )}
        />
      </PageState>
    </>
  );
}

export function ParentRedemptionsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['redemptions', 'requested'],
    queryFn: () => api.get<import('@/api/client').Redemption[]>('/redemptions?status=requested'),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/redemptions/${id}/approve`),
    onSuccess: () => {
      message.success('Đã duyệt đổi thưởng');
      void qc.invalidateQueries({ queryKey: ['redemptions'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: Error) => {
      const msg = e instanceof ApiClientError ? e.message : e.message;
      message.error(msg);
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.post(`/redemptions/${id}/reject`, {}),
    onSuccess: () => {
      message.info('Đã từ chối');
      void qc.invalidateQueries({ queryKey: ['redemptions'] });
    },
  });

  return (
    <>
      <Title level={3}>Duyệt đổi thưởng</Title>
      <PageState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data?.length}
        onRetry={refetch}
        emptyDescription="Không có yêu cầu đổi thưởng"
      >
        <List
          dataSource={data}
          renderItem={(item) => (
            <List.Item>
              <Card style={{ width: '100%' }}>
                <Space direction="vertical">
                  <Text strong>{item.child_name}</Text>
                  <Text>Muốn đổi: {item.reward_title}</Text>
                  <Space>
                    <Button type="primary" icon={<CheckOutlined />} onClick={() => approveMut.mutate(item.id)}>
                      Duyệt
                    </Button>
                    <Button danger icon={<CloseOutlined />} onClick={() => rejectMut.mutate(item.id)}>
                      Từ chối
                    </Button>
                  </Space>
                </Space>
              </Card>
            </List.Item>
          )}
        />
      </PageState>
    </>
  );
}
