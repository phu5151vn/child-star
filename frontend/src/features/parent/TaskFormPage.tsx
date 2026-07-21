import { Button, Form, Input, InputNumber, Segmented, Switch, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Task } from '@/api/client';
import { EmojiPicker } from '@/components/EmojiPicker';
import { PageState } from '@/components/PageState';
import { RECURRENCE_OPTIONS, TASK_EMOJIS } from '@/theme/cute';

const { Title, Text } = Typography;

export function TaskFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const { isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      const task = await api.get<Task>(`/tasks/${id}`);
      form.setFieldsValue(task);
      return task;
    },
    enabled: isEdit,
  });

  const saveMut = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      isEdit ? api.put(`/tasks/${id}`, values) : api.post('/tasks', values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      message.success(isEdit ? t('parent:form.updated') : t('parent:taskForm.created'));
      navigate('/parent/tasks');
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <PageState isLoading={isEdit && isLoading}>
      <Title level={3}>{isEdit ? t('parent:taskForm.editTitle') : t('parent:taskForm.newTitle')}</Title>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 520, marginTop: 24 }}
        initialValues={{ require_proof: false, is_active: true, points: 10, recurrence: 'once', icon_emoji: '⭐' }}
        onFinish={(v) => saveMut.mutate(v)}
      >
        <Form.Item name="title" label={t('parent:taskForm.nameLabel')} rules={[{ required: true, max: 80 }]}>
          <Input placeholder={t('parent:taskForm.namePlaceholder')} />
        </Form.Item>
        <Form.Item name="icon_emoji" label={t('parent:form.iconLabel')}>
          <EmojiPicker options={TASK_EMOJIS} />
        </Form.Item>
        <Form.Item name="description" label={t('parent:form.descLabel')}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="points" label={t('parent:taskForm.pointsLabel')} rules={[{ required: true, type: 'number', min: 1 }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="recurrence"
          label={t('parent:taskForm.recurrenceLabel')}
          extra={<Text type="secondary">{t('parent:taskForm.recurrenceExtra')}</Text>}
        >
          <Segmented options={RECURRENCE_OPTIONS} />
        </Form.Item>
        <Form.Item name="require_proof" label={t('parent:taskForm.requireProofLabel')} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="is_active" label={t('parent:form.activeLabel')} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saveMut.isPending}>
          {t('action.save')}
        </Button>
        <Button style={{ marginLeft: 8 }} onClick={() => navigate('/parent/tasks')}>
          {t('action.cancel')}
        </Button>
      </Form>
    </PageState>
  );
}
