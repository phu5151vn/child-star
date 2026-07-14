import { Button, Card, Space, Steps, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiClientError, type LedgerEntry, type Reward, type Task } from '@/api/client';
import { PageState } from '@/components/PageState';
import { MediaUpload } from '@/components/MediaUpload';
import { LedgerTimeline } from '@/components/LedgerTimeline';
import { PointsBadge } from '@/components/PointsBadge';
import { PointsProgress } from '@/components/PointsProgress';
import { RewardCard } from '@/components/RewardCard';
import { TaskCard } from '@/components/TaskCard';
import { useAuth } from '@/features/auth/AuthContext';

const { Title, Text } = Typography;

export function ChildHomePage() {
  const { me } = useAuth();
  const { data: rewards, isLoading, isError, refetch } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => api.get<Reward[]>('/rewards'),
  });

  const locked = rewards?.filter((r) => !r.is_unlocked && !r.is_out_of_stock) ?? [];
  const nextTarget = locked.sort((a, b) => a.required_points - b.required_points)[0];

  return (
    <PageState
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isLoading && !isError && !nextTarget}
      emptyDescription="Con đã đạt hết mốc thưởng rồi! Tuyệt vời lắm! 🎉"
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <Title level={2} style={{ fontFamily: '"Baloo 2", cursive', margin: 0 }}>
              Tuyệt vời lắm! 🌟
            </Title>
            <PointsBadge balance={me?.balance ?? 0} size="large" />
          </Space>
        </Card>
        {nextTarget && (
          <Card title="Mốc thưởng gần nhất">
            <Text>{nextTarget.title}</Text>
            <PointsProgress current={me?.balance ?? 0} target={nextTarget.required_points} />
            <Text type="secondary">Còn thiếu {nextTarget.missing_points} sao</Text>
          </Card>
        )}
      </Space>
    </PageState>
  );
}

export function ChildTasksPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<Task[]>('/tasks'),
  });

  const claimMut = useMutation({
    mutationFn: (taskId: string) => api.post(`/tasks/${taskId}/claim`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      message.success('Đã nhận nhiệm vụ!');
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <>
      <Title level={3}>Nhiệm vụ của con</Title>
      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch} emptyDescription="Chưa có nhiệm vụ nào">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {data?.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isChild
              onClaim={(id) => claimMut.mutate(id)}
            />
          ))}
        </Space>
      </PageState>
    </>
  );
}

export function ChildTaskDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [proofMediaId, setProofMediaId] = useState<string | undefined>();

  const { data: task, isLoading, isError, refetch } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get<Task>(`/tasks/${id}`),
    enabled: !!id,
  });

  const submitMut = useMutation({
    mutationFn: () =>
      api.post(`/assignments/${task!.assignment_id}/submit`, {
        proof_media_id: proofMediaId ?? null,
      }),
    onSuccess: () => {
      message.success('Đã gửi hoàn thành! Chờ bố mẹ duyệt nhé');
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['task', id] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const status = task?.assignment_status ?? 'available';
  const stepMap: Record<string, number> = { available: 0, in_progress: 1, submitted: 2, approved: 3 };
  const canSubmit = status === 'in_progress' && task?.assignment_id;
  const needsProof = task?.require_proof;

  return (
    <PageState isLoading={isLoading} isError={isError} onRetry={refetch}>
      {task && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={3}>{task.title}</Title>
          <Text>+{task.points} sao khi hoàn thành</Text>
          {task.description && <Text type="secondary">{task.description}</Text>}
          <Steps
            current={stepMap[status] ?? 0}
            items={[
              { title: 'Nhận' },
              { title: 'Làm' },
              { title: 'Gửi' },
              { title: 'Duyệt' },
            ]}
            size="small"
          />
          {canSubmit && needsProof && (
            <Card title="Ảnh minh chứng" size="small">
              <MediaUpload kind="proof" value={proofMediaId} onChange={setProofMediaId} />
            </Card>
          )}
          {canSubmit && (
            <Button
              type="primary"
              size="large"
              block
              loading={submitMut.isPending}
              disabled={needsProof && !proofMediaId}
              onClick={() => submitMut.mutate()}
            >
              Báo hoàn thành! ✅
            </Button>
          )}
          {status === 'submitted' && <Text type="warning">Đang chờ bố mẹ duyệt...</Text>}
          {status === 'approved' && <Text type="success">Hoàn thành rồi! 🎉</Text>}
          <Button onClick={() => navigate('/child/tasks')}>Quay lại</Button>
        </Space>
      )}
    </PageState>
  );
}

export function ChildRewardsPage() {
  const { me, refetchMe } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => api.get<Reward[]>('/rewards'),
  });

  const redeemMut = useMutation({
    mutationFn: (rewardId: string) => api.post(`/rewards/${rewardId}/redeem`),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu đổi thưởng!');
      void qc.invalidateQueries({ queryKey: ['rewards'] });
      void refetchMe();
    },
    onError: (e: Error) => {
      const msg = e instanceof ApiClientError ? e.message : e.message;
      message.error(msg);
    },
  });

  const unlocked = data?.filter((r) => r.is_unlocked) ?? [];
  const locked = data?.filter((r) => !r.is_unlocked) ?? [];

  return (
    <>
      <Title level={3}>Kho thưởng</Title>
      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch} emptyDescription="Chưa có phần thưởng">
        {unlocked.length > 0 && (
          <>
            <Title level={5}>Đã mở khóa 🎁</Title>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }} size="middle">
              {unlocked.map((r) => (
                <RewardCard key={r.id} reward={r} balance={me?.balance} isChild onRedeem={(id) => redeemMut.mutate(id)} />
              ))}
            </Space>
          </>
        )}
        {locked.length > 0 && (
          <>
            <Title level={5}>Đang phấn đấu 🔒</Title>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {locked.map((r) => (
                <RewardCard key={r.id} reward={r} balance={me?.balance} isChild />
              ))}
            </Space>
          </>
        )}
      </PageState>
    </>
  );
}

export function ChildHistoryPage() {
  const { me } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ledger', me?.child_id],
    queryFn: () => api.get<LedgerEntry[]>(`/children/${me!.child_id}/ledger`),
    enabled: !!me?.child_id,
  });

  return (
    <>
      <Title level={3}>Lịch sử điểm</Title>
      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch} emptyDescription="Chưa có giao dịch điểm">
        <LedgerTimeline entries={data ?? []} />
      </PageState>
    </>
  );
}