import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Modal, Space, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Child, type LedgerEntry } from '@/api/client';
import { LedgerTimeline } from '@/components/LedgerTimeline';
import { PageState } from '@/components/PageState';
import { PointsBadge } from '@/components/PointsBadge';

const { Title } = Typography;

export function ParentChildrenPage() {
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

  const createMut = useMutation({
    mutationFn: (values: { display_name: string; pin: string }) => api.post('/children', values),
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
        <Title level={3} style={{ margin: 0 }}>Con & Sổ điểm</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Thêm con
        </Button>
      </Space>
      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {data?.map((child) => (
            <Card key={child.id}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space direction="vertical">
                  <Title level={5} style={{ margin: 0 }}>{child.display_name}</Title>
                  <PointsBadge balance={child.balance} size="small" />
                </Space>
                <Space>
                  <Button onClick={() => setAdjustModal(child)}>Điều chỉnh điểm</Button>
                  <Button type="link" onClick={() => navigate(`/parent/children/${child.id}`)}>
                    Xem sổ điểm
                  </Button>
                </Space>
              </Space>
            </Card>
          ))}
        </Space>
      </PageState>

      <Modal title="Thêm con" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)}>
          <Form.Item name="display_name" label="Tên con" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pin" label="PIN 4 số" rules={[{ required: true, len: 4 }]}>
            <Input maxLength={4} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createMut.isPending}>Tạo</Button>
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