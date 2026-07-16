import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Modal, Space, Switch, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type Relative } from '@/api/client';
import { PageState } from '@/components/PageState';
import { useAuth } from '@/features/auth/AuthContext';

const { Title, Text } = Typography;

const PERMISSION_LABELS: { key: keyof Relative; label: string }[] = [
  { key: 'can_manage_members', label: 'Thêm/sửa thành viên' },
  { key: 'can_approve_tasks', label: 'Duyệt hoàn thành nhiệm vụ' },
  { key: 'can_approve_rewards', label: 'Duyệt đổi thưởng' },
];

export function ParentRelativesPage() {
  const { me } = useAuth();
  const canManage = me?.can_manage_members ?? false;
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['relatives'],
    queryFn: () => api.get<Relative[]>('/relatives'),
    enabled: canManage,
  });

  const createMut = useMutation({
    mutationFn: (values: { email: string; password: string; display_name: string }) =>
      api.post('/relatives', values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['relatives'] });
      setModalOpen(false);
      form.resetFields();
      message.success('Đã thêm người thân đồng hành');
    },
    onError: (e: Error) => message.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Relative> }) =>
      api.patch(`/relatives/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['relatives'] });
      message.success('Đã cập nhật quyền');
    },
    onError: (e: Error) => message.error(e.message),
  });

  if (!canManage) {
    return (
      <>
        <Title level={3} style={{ marginTop: 0 }}>👪 Người thân đồng hành</Title>
        <Alert type="info" showIcon message="Chỉ quản trị viên gia đình mới quản lý được người thân." />
      </>
    );
  }

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>👪 Người thân đồng hành</Title>
        <Button type="primary" shape="round" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Thêm người thân
        </Button>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Người thân đăng nhập bằng email/mật khẩu như bố mẹ, cùng đồng hành quản lý gia đình.
        Mặc định KHÔNG có quyền thêm thành viên, duyệt nhiệm vụ và duyệt đổi thưởng — bạn có thể cấp thêm bên dưới.
      </Text>

      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch} emptyDescription="Chưa có người thân nào">
        <Space direction="vertical" className="bn-stagger" style={{ width: '100%' }} size="middle">
          {data?.map((r) => (
            <Card key={r.id} className="bn-card-hover" style={{ borderRadius: 20, opacity: r.is_active ? 1 : 0.6 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
                <Space direction="vertical" size={2}>
                  <Space>
                    <Title level={5} style={{ margin: 0 }}>{r.display_name}</Title>
                    {r.is_admin && <Tag color="purple">Quản trị viên</Tag>}
                    {!r.is_active && <Tag>Đã khóa</Tag>}
                  </Space>
                  <Text type="secondary">{r.email}</Text>
                </Space>
                {!r.is_admin && (
                  <Switch
                    checkedChildren="Đang hoạt động"
                    unCheckedChildren="Đã khóa"
                    checked={r.is_active}
                    loading={updateMut.isPending}
                    onChange={(v) => updateMut.mutate({ id: r.id, patch: { is_active: v } })}
                  />
                )}
              </Space>
              <div style={{ marginTop: 12 }}>
                {PERMISSION_LABELS.map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <Text>{label}</Text>
                    <Switch
                      size="small"
                      checked={r[key] as boolean}
                      disabled={r.is_admin}
                      onChange={(v) => updateMut.mutate({ id: r.id, patch: { [key]: v } })}
                    />
                  </div>
                ))}
                {r.is_admin && (
                  <Text type="secondary" style={{ fontSize: 12 }}>Quản trị viên luôn có đủ quyền.</Text>
                )}
              </div>
            </Card>
          ))}
        </Space>
      </PageState>

      <Modal title="Thêm người thân đồng hành" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)}>
          <Form.Item name="display_name" label="Tên hiển thị" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="Ví dụ: Bà ngoại" />
          </Form.Item>
          <Form.Item name="email" label="Email đăng nhập" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="Tối thiểu 6 ký tự" />
          </Form.Item>
          <Button type="primary" shape="round" htmlType="submit" loading={createMut.isPending}>
            Tạo tài khoản
          </Button>
        </Form>
      </Modal>
    </>
  );
}
