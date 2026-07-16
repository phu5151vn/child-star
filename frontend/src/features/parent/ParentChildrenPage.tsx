import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Modal, Segmented, Space, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Child, type LedgerEntry, type WeeklyGoal, type WeeklyProgress } from '@/api/client';
import { ChildAvatar } from '@/components/CuteBits';
import { LedgerTimeline } from '@/components/LedgerTimeline';
import { PageState } from '@/components/PageState';
import { PointsBadge } from '@/components/PointsBadge';
import { WeeklyProgressCard } from '@/components/WeeklyProgressCard';
import { useAuth } from '@/features/auth/AuthContext';
import { GENDER_OPTIONS } from '@/theme/cute';

const { Title } = Typography;

function buildProgress(child: Child, goal?: WeeklyGoal): WeeklyProgress | null {
  if (!goal?.is_active || !goal.target_count || !goal.bonus_points) return null;
  const completed = child.weekly_completed ?? 0;
  const achieved = completed >= goal.target_count;
  return {
    child_id: child.id,
    enabled: true,
    target_count: goal.target_count,
    bonus_points: goal.bonus_points,
    completed,
    remaining: Math.max(0, goal.target_count - completed),
    achieved,
    bonus_earned: achieved,
  };
}

export function ParentChildrenPage() {
  const { me } = useAuth();
  const canManage = me?.can_manage_members ?? false;
  const [modalOpen, setModalOpen] = useState(false);
  const [adjustModal, setAdjustModal] = useState<Child | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [adjustForm] = Form.useForm();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get<Child[]>('/children'),
  });
  const { data: goal } = useQuery({
    queryKey: ['weekly-goal'],
    queryFn: () => api.get<WeeklyGoal>('/weekly-goal'),
  });

  const createMut = useMutation({
    mutationFn: (values: { display_name: string; pin: string; gender?: string }) => api.post('/children', values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['children'] });
      setModalOpen(false);
      form.resetFields();
      message.success('Đã tạo hồ sơ con');
    },
  });

  const adjustMut = useMutation({
    mutationFn: ({ childId, delta, reason }: { childId: string; delta: number; reason: string }) =>
      api.post(`/children/${childId}/adjust`, { delta, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['children'] });
      setAdjustModal(null);
      adjustForm.resetFields();
      message.success('Đã điều chỉnh điểm');
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>👨‍👩‍👧 Con & Sổ điểm</Title>
        {canManage && (
          <Button type="primary" shape="round" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Thêm con
          </Button>
        )}
      </Space>
      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch}>
        <Space direction="vertical" className="bn-stagger" style={{ width: '100%' }} size="middle">
          {data?.map((child) => {
            const wp = buildProgress(child, goal);
            return (
              <Card key={child.id} className="bn-card-hover" style={{ borderRadius: 24 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
                  <Space align="center" size="middle">
                    <ChildAvatar name={child.display_name} gender={child.gender} size={56} />
                    <Space direction="vertical" size={2}>
                      <Title level={5} style={{ margin: 0 }}>{child.display_name}</Title>
                      <PointsBadge balance={child.balance} size="small" />
                    </Space>
                  </Space>
                  <Space>
                    <Button shape="round" onClick={() => setAdjustModal(child)}>Điều chỉnh điểm</Button>
                    <Button type="link" onClick={() => navigate(`/parent/children/${child.id}`)}>
                      Xem sổ điểm
                    </Button>
                  </Space>
                </Space>
                {wp && (
                  <div style={{ marginTop: 14 }}>
                    <WeeklyProgressCard progress={wp} compact />
                  </div>
                )}
              </Card>
            );
          })}
        </Space>
      </PageState>

      <Modal title="Thêm con" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" initialValues={{ gender: 'female' }} onFinish={(v) => createMut.mutate(v)}>
          <Form.Item name="display_name" label="Tên con" rules={[{ required: true }]}>
            <Input placeholder="Ví dụ: Bé An" />
          </Form.Item>
          <Form.Item name="gender" label="Giới tính">
            <Segmented options={GENDER_OPTIONS} />
          </Form.Item>
          <Form.Item name="pin" label="PIN 4 số" rules={[{ required: true, len: 4 }]}>
            <Input maxLength={4} />
          </Form.Item>
          <Button type="primary" shape="round" htmlType="submit" loading={createMut.isPending}>Tạo</Button>
        </Form>
      </Modal>

      <Modal title={`Điều chỉnh điểm — ${adjustModal?.display_name}`} open={!!adjustModal} onCancel={() => setAdjustModal(null)} footer={null}>
        <Form form={adjustForm} layout="vertical" onFinish={(v) => adjustMut.mutate({ childId: adjustModal!.id, ...v })}>
          <Form.Item name="delta" label="Số điểm (+/-)" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}>
            <Input.TextArea />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={adjustMut.isPending}>Lưu</Button>
        </Form>
      </Modal>
    </>
  );
}

export function ParentChildLedgerPage() {
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ledger', id],
    queryFn: () => api.get<LedgerEntry[]>(`/children/${id}/ledger`),
    enabled: !!id,
  });

  return (
    <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch}>
      <Title level={3}>Sổ điểm</Title>
      <LedgerTimeline entries={data ?? []} />
    </PageState>
  );
}