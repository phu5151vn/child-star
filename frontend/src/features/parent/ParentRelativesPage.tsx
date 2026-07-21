import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Modal, Space, Switch, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Relative } from '@/api/client';
import { PageState } from '@/components/PageState';
import { useAuth } from '@/features/auth/AuthContext';

const { Title, Text } = Typography;

const PERMISSION_LABELS: { key: keyof Relative; labelKey: string }[] = [
  { key: 'can_manage_members', labelKey: 'parent:relatives.perm.manageMembers' },
  { key: 'can_approve_tasks', labelKey: 'parent:relatives.perm.approveTasks' },
  { key: 'can_approve_rewards', labelKey: 'parent:relatives.perm.approveRewards' },
];

export function ParentRelativesPage() {
  const { t } = useTranslation();
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
      message.success(t('parent:relatives.added'));
    },
    onError: (e: Error) => message.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Relative> }) =>
      api.patch(`/relatives/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['relatives'] });
      message.success(t('parent:relatives.permUpdated'));
    },
    onError: (e: Error) => message.error(e.message),
  });

  if (!canManage) {
    return (
      <>
        <Title level={3} style={{ marginTop: 0 }}>{t('parent:relatives.title')}</Title>
        <Alert type="info" showIcon message={t('parent:relatives.noPermission')} />
      </>
    );
  }

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>{t('parent:relatives.title')}</Title>
        <Button type="primary" shape="round" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          {t('parent:relatives.addBtn')}
        </Button>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {t('parent:relatives.description')}
      </Text>

      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch} emptyDescription={t('parent:relatives.empty')}>
        <Space direction="vertical" className="bn-stagger" style={{ width: '100%' }} size="middle">
          {data?.map((r) => (
            <Card key={r.id} className="bn-card-hover" style={{ borderRadius: 20, opacity: r.is_active ? 1 : 0.6 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
                <Space direction="vertical" size={2}>
                  <Space>
                    <Title level={5} style={{ margin: 0 }}>{r.display_name}</Title>
                    {r.is_admin && <Tag color="purple">{t('parent:relatives.adminTag')}</Tag>}
                    {!r.is_active && <Tag>{t('parent:relatives.lockedTag')}</Tag>}
                  </Space>
                  <Text type="secondary">{r.email}</Text>
                </Space>
                {!r.is_admin && (
                  <Switch
                    checkedChildren={t('parent:relatives.activeSwitch')}
                    unCheckedChildren={t('parent:relatives.lockedSwitch')}
                    checked={r.is_active}
                    loading={updateMut.isPending}
                    onChange={(v) => updateMut.mutate({ id: r.id, patch: { is_active: v } })}
                  />
                )}
              </Space>
              <div style={{ marginTop: 12 }}>
                {PERMISSION_LABELS.map(({ key, labelKey }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <Text>{t(labelKey)}</Text>
                    <Switch
                      size="small"
                      checked={r[key] as boolean}
                      disabled={r.is_admin}
                      onChange={(v) => updateMut.mutate({ id: r.id, patch: { [key]: v } })}
                    />
                  </div>
                ))}
                {r.is_admin && (
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('parent:relatives.adminAllPerms')}</Text>
                )}
              </div>
            </Card>
          ))}
        </Space>
      </PageState>

      <Modal title={t('parent:relatives.modalTitle')} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)}>
          <Form.Item name="display_name" label={t('parent:relatives.displayNameLabel')} rules={[{ required: true, message: t('parent:relatives.displayNameRequired') }]}>
            <Input placeholder={t('parent:relatives.displayNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="email" label={t('parent:relatives.emailLabel')} rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="password" label={t('parent:relatives.passwordLabel')} rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder={t('parent:relatives.passwordPlaceholder')} />
          </Form.Item>
          <Button type="primary" shape="round" htmlType="submit" loading={createMut.isPending}>
            {t('parent:relatives.createBtn')}
          </Button>
        </Form>
      </Modal>
    </>
  );
}
