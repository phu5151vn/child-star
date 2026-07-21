import { Button, Card, Space, Steps, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiClientError, type Assignment, type LedgerEntry, type Redemption, type Reward, type Task, type WeeklyProgress } from '@/api/client';
import { PageState } from '@/components/PageState';
import { CustomRequestButton } from '@/components/CustomRequestButton';
import { MediaUpload } from '@/components/MediaUpload';
import { LedgerTimeline } from '@/components/LedgerTimeline';
import { PointsBadge } from '@/components/PointsBadge';
import { PointsProgress } from '@/components/PointsProgress';
import { RewardCard } from '@/components/RewardCard';
import { TaskCard } from '@/components/TaskCard';
import { WeeklyProgressCard } from '@/components/WeeklyProgressCard';
import { useAuth } from '@/features/auth/AuthContext';

const { Title, Text } = Typography;

export function ChildHomePage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const { data: rewards, isLoading, isError, refetch } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => api.get<Reward[]>('/rewards'),
  });
  const { data: weekly } = useQuery({
    queryKey: ['weekly-progress', me?.child_id],
    queryFn: () => api.get<WeeklyProgress>('/weekly-progress'),
    enabled: !!me?.child_id,
  });

  const locked = rewards?.filter((r) => !r.is_unlocked && !r.is_out_of_stock) ?? [];
  const nextTarget = locked.sort((a, b) => a.required_points - b.required_points)[0];

  return (
    <PageState isLoading={isLoading} isError={isError} onRetry={refetch}>
      <Space direction="vertical" size="large" className="bn-stagger" style={{ width: '100%' }}>
        <Card style={{ borderRadius: 24, background: 'linear-gradient(135deg,#efe9ff,#fdeef7)' }}>
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <div className="bn-float" style={{ fontSize: 44 }}>🌟</div>
            <Title level={2} style={{ fontFamily: '"Baloo 2", cursive', margin: 0 }}>
              {t('child:home.hero')}
            </Title>
            <PointsBadge balance={me?.balance ?? 0} size="large" />
          </Space>
        </Card>
        {weekly?.enabled && (
          <Card className="bn-card-hover" style={{ borderRadius: 24 }}>
            <WeeklyProgressCard progress={weekly} />
          </Card>
        )}
        {nextTarget && (
          <Card className="bn-card-hover" title={t('child:home.nextTargetTitle')} style={{ borderRadius: 24 }}>
            <Text strong>{nextTarget.title}</Text>
            <PointsProgress current={me?.balance ?? 0} target={nextTarget.required_points} />
            <Text type="secondary">{t('child:home.missingPoints', { count: nextTarget.missing_points })}</Text>
          </Card>
        )}
      </Space>
    </PageState>
  );
}

export function ChildTasksPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<Task[]>('/tasks'),
  });
  // Nhiệm vụ con tự đề xuất đang chờ bố mẹ duyệt.
  const { data: submitted } = useQuery({
    queryKey: ['assignments', 'submitted'],
    queryFn: () => api.get<Assignment[]>('/assignments?status=submitted'),
  });

  const claimMut = useMutation({
    mutationFn: (taskId: string) => api.post(`/tasks/${taskId}/claim`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['task'] });
      message.success(t('child:tasks.claimSuccess'));
    },
    onError: (e: Error) => message.error(e.message),
  });

  const customMut = useMutation({
    mutationFn: (title: string) => api.post('/assignments/custom', { title }),
    onSuccess: () => {
      message.success(t('child:tasks.proposeSuccess'));
      void qc.invalidateQueries({ queryKey: ['assignments', 'submitted'] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const customPending = submitted?.filter((a) => a.is_custom) ?? [];

  return (
    <>
      <Title level={3}>{t('child:tasks.title')}</Title>
      <div style={{ marginBottom: 20 }}>
        <CustomRequestButton
          label={t('child:tasks.proposeLabel')}
          modalTitle={t('child:tasks.proposeModalTitle')}
          placeholder={t('child:tasks.proposePlaceholder')}
          submitting={customMut.isPending}
          onSubmit={(t) => customMut.mutateAsync(t)}
        />
      </div>
      {customPending.length > 0 && (
        <>
          <Title level={5}>{t('child:tasks.pendingTitle')}</Title>
          <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }} size="middle">
            {customPending.map((a) => (
              <Card key={a.id} style={{ borderRadius: 16, background: '#fff7e6' }} styles={{ body: { padding: 14 } }}>
                <Space>
                  <span style={{ fontSize: 22 }}>✨</span>
                  <Text strong>{a.task_title}</Text>
                  <Text type="secondary">{t('child:tasks.pendingHint')}</Text>
                </Space>
              </Card>
            ))}
          </Space>
        </>
      )}
      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch} emptyDescription={t('child:tasks.empty')}>
        <Space direction="vertical" className="bn-stagger" style={{ width: '100%' }} size="middle">
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
  const { t } = useTranslation();
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
      message.success(t('child:taskDetail.submitSuccess'));
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
          <Text>{t('child:taskDetail.pointsOnComplete', { count: task.points })}</Text>
          {task.description && <Text type="secondary">{task.description}</Text>}
          <Steps
            current={stepMap[status] ?? 0}
            items={[
              { title: t('child:taskDetail.steps.claim') },
              { title: t('child:taskDetail.steps.doing') },
              { title: t('child:taskDetail.steps.submit') },
              { title: t('child:taskDetail.steps.approve') },
            ]}
            size="small"
          />
          {canSubmit && needsProof && (
            <Card title={t('child:taskDetail.proofTitle')} size="small">
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
              {t('child:taskDetail.submitButton')}
            </Button>
          )}
          {status === 'submitted' && <Text type="warning">{t('child:taskDetail.waitingApproval')}</Text>}
          {status === 'approved' && <Text type="success">{t('child:taskDetail.approved')}</Text>}
          <Button onClick={() => navigate('/child/tasks')}>{t('action.back')}</Button>
        </Space>
      )}
    </PageState>
  );
}

export function ChildRewardsPage() {
  const { t } = useTranslation();
  const { me, refetchMe } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => api.get<Reward[]>('/rewards'),
  });
  // Yêu cầu đổi thưởng đang chờ của con (gồm cả yêu cầu tự do ngoài danh sách).
  const { data: myRequests } = useQuery({
    queryKey: ['redemptions', 'requested'],
    queryFn: () => api.get<Redemption[]>('/redemptions?status=requested'),
  });

  const redeemMut = useMutation({
    mutationFn: (rewardId: string) => api.post(`/rewards/${rewardId}/redeem`),
    onSuccess: () => {
      message.success(t('child:rewards.redeemSuccess'));
      // Số dư khả dụng đã giảm ngay -> làm mới số sao và kho thưởng để phản ánh.
      void qc.invalidateQueries({ queryKey: ['rewards'] });
      void refetchMe();
    },
    onError: (e: Error) => {
      const msg = e instanceof ApiClientError ? e.message : e.message;
      message.error(msg);
    },
  });

  const customMut = useMutation({
    mutationFn: (title: string) => api.post('/redemptions/custom', { title }),
    onSuccess: () => {
      message.success(t('child:rewards.wishSuccess'));
      void qc.invalidateQueries({ queryKey: ['redemptions', 'requested'] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const customPending = myRequests?.filter((r) => r.is_custom) ?? [];
  const pending = data?.filter((r) => r.is_pending) ?? [];
  const unlocked = data?.filter((r) => r.is_unlocked && !r.is_pending) ?? [];
  const locked = data?.filter((r) => !r.is_unlocked && !r.is_pending) ?? [];

  return (
    <>
      <Title level={3}>{t('child:rewards.title')}</Title>
      <div style={{ marginBottom: 20 }}>
        <CustomRequestButton
          label={t('child:rewards.requestLabel')}
          modalTitle={t('child:rewards.requestModalTitle')}
          placeholder={t('child:rewards.requestPlaceholder')}
          submitting={customMut.isPending}
          onSubmit={(t) => customMut.mutateAsync(t)}
        />
      </div>
      {customPending.length > 0 && (
        <>
          <Title level={5}>{t('child:rewards.wishPendingTitle')}</Title>
          <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }} size="middle">
            {customPending.map((r) => (
              <Card key={r.id} style={{ borderRadius: 16, background: '#fff7e6' }} styles={{ body: { padding: 14 } }}>
                <Space>
                  <span style={{ fontSize: 22 }}>✨</span>
                  <Text strong>{r.reward_title}</Text>
                  <Text type="secondary">{t('child:rewards.pendingHint')}</Text>
                </Space>
              </Card>
            ))}
          </Space>
        </>
      )}
      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch} emptyDescription={t('child:rewards.empty')}>
        {pending.length > 0 && (
          <>
            <Title level={5}>{t('child:rewards.pendingTitle')}</Title>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }} size="middle">
              {pending.map((r) => (
                <RewardCard key={r.id} reward={r} balance={me?.balance} isChild />
              ))}
            </Space>
          </>
        )}
        {unlocked.length > 0 && (
          <>
            <Title level={5}>{t('child:rewards.unlockedTitle')}</Title>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }} size="middle">
              {unlocked.map((r) => (
                <RewardCard key={r.id} reward={r} balance={me?.balance} isChild onRedeem={(id) => redeemMut.mutate(id)} />
              ))}
            </Space>
          </>
        )}
        {locked.length > 0 && (
          <>
            <Title level={5}>{t('child:rewards.lockedTitle')}</Title>
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
  const { t } = useTranslation();
  const { me } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ledger', me?.child_id],
    queryFn: () => api.get<LedgerEntry[]>(`/children/${me!.child_id}/ledger`),
    enabled: !!me?.child_id,
  });

  return (
    <>
      <Title level={3}>{t('child:history.title')}</Title>
      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch} emptyDescription={t('child:history.empty')}>
        <LedgerTimeline entries={data ?? []} />
      </PageState>
    </>
  );
}