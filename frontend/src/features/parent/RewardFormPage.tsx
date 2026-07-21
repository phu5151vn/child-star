import { Button, Form, Input, InputNumber, Switch, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Reward } from '@/api/client';
import { EmojiPicker } from '@/components/EmojiPicker';
import { PageState } from '@/components/PageState';
import { REWARD_EMOJIS } from '@/theme/cute';

const { Title } = Typography;

export function RewardFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const { isLoading } = useQuery({
    queryKey: ['reward', id],
    queryFn: async () => {
      const reward = await api.get<Reward>(`/rewards/${id}`);
      form.setFieldsValue(reward);
      return reward;
    },
    enabled: isEdit,
  });

  const saveMut = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      isEdit ? api.put(`/rewards/${id}`, values) : api.post('/rewards', values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rewards'] });
      message.success(isEdit ? t('parent:form.updated') : t('parent:rewardForm.created'));
      navigate('/parent/rewards');
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <PageState isLoading={isEdit && isLoading}>
      <Title level={3}>{isEdit ? t('parent:rewardForm.editTitle') : t('parent:rewardForm.newTitle')}</Title>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 480, marginTop: 24 }}
        initialValues={{ is_active: true, required_points: 50, icon_emoji: '🎁' }}
        onFinish={(v) => saveMut.mutate(v)}
      >
        <Form.Item name="title" label={t('parent:rewardForm.nameLabel')} rules={[{ required: true }]}>
          <Input placeholder={t('parent:rewardForm.namePlaceholder')} />
        </Form.Item>
        <Form.Item name="icon_emoji" label={t('parent:form.iconLabel')}>
          <EmojiPicker options={REWARD_EMOJIS} />
        </Form.Item>
        <Form.Item name="description" label={t('parent:form.descLabel')}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="required_points" label={t('parent:rewardForm.pointsLabel')} rules={[{ required: true, type: 'number', min: 1 }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="stock" label={t('parent:rewardForm.stockLabel')}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="is_active" label={t('parent:form.activeLabel')} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saveMut.isPending}>{t('action.save')}</Button>
        <Button style={{ marginLeft: 8 }} onClick={() => navigate('/parent/rewards')}>{t('action.cancel')}</Button>
      </Form>
    </PageState>
  );
}
