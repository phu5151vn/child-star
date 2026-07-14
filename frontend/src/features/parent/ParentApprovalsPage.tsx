import { CheckOutlined, CloseOutlined, StarFilled } from '@ant-design/icons';
import { Button, Card, Space, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError, type Assignment, type Redemption } from '@/api/client';
import { celebratePoints } from '@/components/CelebrationFx';
import { ChildAvatar, EmojiIcon } from '@/components/CuteBits';
import { PageState } from '@/components/PageState';
import { defaultRewardEmoji, defaultTaskEmoji } from '@/theme/cute';

const { Title, Text } = Typography;

/** Card duyệt dùng chung cho cả nhiệm vụ và đổi thưởng. */
interface ApprovalCardProps {
  emoji: string;
  childName?: string;
  childGender?: 'male' | 'female' | null;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  points?: number;
  pointsPrefix?: string;
  onApprove: () => void;
  onReject: () => void;
  approving?: boolean;
}

function ApprovalCard({
  emoji,
  childName,
  childGender,
  title,
  subtitle,
  points,
  pointsPrefix = '+',
  onApprove,
  onReject,
  approving,
}: ApprovalCardProps) {
  return (
    <Card className="bn-card-hover" style={{ borderRadius: 24 }} styles={{ body: { padding: 16 } }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <EmojiIcon emoji={emoji} size={58} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space align="center" size={8} style={{ marginBottom: 2 }}>
            <ChildAvatar name={childName} gender={childGender} size={28} />
            <Text strong>{childName}</Text>
          </Space>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 16 }}>{title}</Text>
            {points != null && (
              <Tag icon={<StarFilled />} color="gold" style={{ borderRadius: 999, fontWeight: 700, margin: 0 }}>
                {pointsPrefix}{points} sao
              </Tag>
            )}
          </div>
          {subtitle && (
            <Text type="secondary" style={{ display: 'block', marginTop: 2 }}>{subtitle}</Text>
          )}
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" shape="round" icon={<CheckOutlined />} loading={approving} onClick={onApprove}>
              Duyệt
            </Button>
            <Button danger shape="round" icon={<CloseOutlined />} onClick={onReject}>
              Từ chối
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  );
}

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
      message.success(`Đã duyệt! +${item?.task_points ?? 0} sao ⭐`);
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
      <Title level={3} style={{ marginTop: 0 }}>🏆 Duyệt hoàn thành nhiệm vụ</Title>
      <PageState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data?.length}
        onRetry={refetch}
        emptyDescription="Không có nhiệm vụ chờ duyệt 🎉"
      >
        <Space direction="vertical" className="bn-stagger" style={{ width: '100%' }} size="middle">
          {data?.map((item) => (
            <ApprovalCard
              key={item.id}
              emoji={item.task_emoji || defaultTaskEmoji(item.task_title)}
              childName={item.child_name}
              childGender={item.child_gender}
              title={item.task_title}
              points={item.task_points}
              approving={approveMut.isPending && approveMut.variables === item.id}
              onApprove={() => approveMut.mutate(item.id)}
              onReject={() => rejectMut.mutate(item.id)}
            />
          ))}
        </Space>
      </PageState>
    </>
  );
}

export function ParentRedemptionsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['redemptions', 'requested'],
    queryFn: () => api.get<Redemption[]>('/redemptions?status=requested'),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/redemptions/${id}/approve`),
    onSuccess: () => {
      message.success('Đã duyệt đổi thưởng 🎁');
      celebratePoints();
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
      <Title level={3} style={{ marginTop: 0 }}>🎁 Duyệt đổi thưởng</Title>
      <PageState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data?.length}
        onRetry={refetch}
        emptyDescription="Không có yêu cầu đổi thưởng 🎉"
      >
        <Space direction="vertical" className="bn-stagger" style={{ width: '100%' }} size="middle">
          {data?.map((item) => (
            <ApprovalCard
              key={item.id}
              emoji={item.reward_emoji || defaultRewardEmoji(item.reward_title)}
              childName={item.child_name}
              childGender={item.child_gender}
              title={<>Muốn đổi: <b>{item.reward_title}</b></>}
              subtitle="Đổi thưởng sẽ trừ sao trong sổ điểm của con"
              approving={approveMut.isPending && approveMut.variables === item.id}
              onApprove={() => approveMut.mutate(item.id)}
              onReject={() => rejectMut.mutate(item.id)}
            />
          ))}
        </Space>
      </PageState>
    </>
  );
}
