import { useState } from 'react';
import { CheckOutlined, CloseOutlined, StarFilled } from '@ant-design/icons';
import { Alert, Button, Card, InputNumber, Space, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError, type Assignment, type Redemption } from '@/api/client';
import { celebratePoints } from '@/components/CelebrationFx';
import { ChildAvatar, EmojiIcon } from '@/components/CuteBits';
import { MediaImage } from '@/components/MediaImage';
import { PageState } from '@/components/PageState';
import { useAuth } from '@/features/auth/AuthContext';
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
  proofMediaId?: string;
  /** Khi true: hiện ô nhập số sao (yêu cầu tự do), onApprove nhận số sao bố mẹ nhập. */
  askPoints?: boolean;
  pointsPrompt?: string;
  /** Khi true: chỉ xem, ẩn nút duyệt/từ chối (tài khoản không có quyền duyệt). */
  readOnly?: boolean;
  onApprove: (points?: number) => void;
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
  proofMediaId,
  askPoints,
  pointsPrompt = 'Số sao',
  readOnly,
  onApprove,
  onReject,
  approving,
}: ApprovalCardProps) {
  const [pts, setPts] = useState<number | null>(null);
  const canApprove = !askPoints || (pts != null && pts > 0);
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
          {proofMediaId && (
            <div style={{ marginTop: 10 }}>
              <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                📷 Ảnh minh chứng (bấm để xem lớn)
              </Text>
              <MediaImage mediaId={proofMediaId} size={84} />
            </div>
          )}
          {!readOnly && askPoints && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                {pointsPrompt}
              </Text>
              <InputNumber
                min={1}
                max={100000}
                value={pts}
                onChange={(v) => setPts(v)}
                placeholder="Nhập số sao"
                addonAfter="sao"
                style={{ width: 180 }}
              />
            </div>
          )}
          {readOnly ? (
            <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>⏳ Đang chờ quản trị viên duyệt</Text>
          ) : (
            <Space style={{ marginTop: 12 }}>
              <Button
                type="primary"
                shape="round"
                icon={<CheckOutlined />}
                loading={approving}
                disabled={!canApprove}
                onClick={() => onApprove(pts ?? undefined)}
              >
                Duyệt
              </Button>
              <Button danger shape="round" icon={<CloseOutlined />} onClick={onReject}>
                Từ chối
              </Button>
            </Space>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ParentApprovalsPage() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const canApprove = me?.can_approve_tasks ?? false;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['assignments', 'submitted'],
    queryFn: () => api.get<Assignment[]>('/assignments?status=submitted'),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, points }: { id: string; points?: number }) =>
      api.post(`/assignments/${id}/approve`, points != null ? { points } : undefined),
    onSuccess: (_d, { id, points }) => {
      const item = data?.find((a) => a.id === id);
      const awarded = points ?? item?.task_points ?? 0;
      message.success(`Đã duyệt! +${awarded} sao ⭐`);
      celebratePoints();
      // Xóa ngay khỏi hàng đợi tại cache (badge menu dùng chung key nên tự giảm),
      // không gọi lại API danh sách.
      qc.setQueryData<Assignment[]>(['assignments', 'submitted'], (old) =>
        old?.filter((a) => a.id !== id) ?? [],
      );
      // Điểm con thay đổi -> đánh dấu cũ để tự làm mới khi mở các trang liên quan.
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['children'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
      void qc.invalidateQueries({ queryKey: ['weekly-progress'] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.post(`/assignments/${id}/reject`, { reason: 'Cần làm lại nhé!' }),
    onSuccess: (_d, id) => {
      message.info('Đã từ chối');
      qc.setQueryData<Assignment[]>(['assignments', 'submitted'], (old) =>
        old?.filter((a) => a.id !== id) ?? [],
      );
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <>
      <Title level={3} style={{ marginTop: 0 }}>🏆 Duyệt hoàn thành nhiệm vụ</Title>
      {!canApprove && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Tài khoản của bạn không có quyền duyệt nhiệm vụ. Bạn chỉ xem được danh sách chờ duyệt."
        />
      )}
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
              title={item.is_custom ? <>Con đề xuất: <b>{item.task_title}</b></> : item.task_title}
              subtitle={item.is_custom ? 'Con tự đề xuất việc này — nhập số sao thưởng khi duyệt' : undefined}
              points={item.is_custom ? undefined : item.task_points}
              proofMediaId={item.proof_media_id}
              askPoints={item.is_custom}
              pointsPrompt="Số sao thưởng cho việc này"
              readOnly={!canApprove}
              approving={approveMut.isPending && approveMut.variables?.id === item.id}
              onApprove={(points) => approveMut.mutate({ id: item.id, points })}
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
  const { me } = useAuth();
  const canApprove = me?.can_approve_rewards ?? false;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['redemptions', 'requested'],
    queryFn: () => api.get<Redemption[]>('/redemptions?status=requested'),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, points }: { id: string; points?: number }) =>
      api.post(`/redemptions/${id}/approve`, points != null ? { points_spent: points } : undefined),
    onSuccess: (_d, { id }) => {
      message.success('Đã duyệt đổi thưởng 🎁');
      celebratePoints();
      // Xóa khỏi hàng đợi tại cache; điểm đã "giữ chỗ" nay ghi sổ thật.
      qc.setQueryData<Redemption[]>(['redemptions', 'requested'], (old) =>
        old?.filter((r) => r.id !== id) ?? [],
      );
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['children'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
      void qc.invalidateQueries({ queryKey: ['rewards'] });
    },
    onError: (e: Error) => {
      const msg = e instanceof ApiClientError ? e.message : e.message;
      message.error(msg);
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.post(`/redemptions/${id}/reject`, {}),
    onSuccess: (_d, id) => {
      message.info('Đã từ chối, sao được hoàn lại cho con');
      // Từ chối -> phần giữ chỗ được nhả ra, số dư con tự khôi phục.
      qc.setQueryData<Redemption[]>(['redemptions', 'requested'], (old) =>
        old?.filter((r) => r.id !== id) ?? [],
      );
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['children'] });
      void qc.invalidateQueries({ queryKey: ['rewards'] });
    },
  });

  return (
    <>
      <Title level={3} style={{ marginTop: 0 }}>🎁 Duyệt đổi thưởng</Title>
      {!canApprove && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Tài khoản của bạn không có quyền duyệt đổi thưởng. Bạn chỉ xem được danh sách chờ duyệt."
        />
      )}
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
              title={item.is_custom ? <>Con xin (tự do): <b>{item.reward_title}</b></> : <>Muốn đổi: <b>{item.reward_title}</b></>}
              subtitle={item.is_custom ? 'Con tự đề xuất — nhập số sao cần để đổi khi duyệt' : 'Đổi thưởng sẽ trừ sao trong sổ điểm của con'}
              askPoints={item.is_custom}
              pointsPrompt="Số sao cần để đổi phần thưởng này"
              readOnly={!canApprove}
              approving={approveMut.isPending && approveMut.variables?.id === item.id}
              onApprove={(points) => approveMut.mutate({ id: item.id, points })}
              onReject={() => rejectMut.mutate(item.id)}
            />
          ))}
        </Space>
      </PageState>
    </>
  );
}
