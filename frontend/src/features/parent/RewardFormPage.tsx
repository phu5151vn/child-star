import { Button, Form, Input, InputNumber, Switch, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Reward } from '@/api/client';
import { EmojiPicker } from '@/components/EmojiPicker';
import { PageState } from '@/components/PageState';
import { REWARD_EMOJIS } from '@/theme/cute';

const { Title } = Typography;

export function RewardFormPage() {
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
      message.success(isEdit ? 'Đã cập nhật' : 'Đã tạo phần thưởng');
      navigate('/parent/rewards');
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <PageState isLoading={isEdit && isLoading}>
      <Title level={3}>{isEdit ? 'Sửa phần thưởng' : 'Tạo phần thưởng mới'}</Title>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 480, marginTop: 24 }}
        initialValues={{ is_active: true, required_points: 50, icon_emoji: '🎁' }}
        onFinish={(v) => saveMut.mutate(v)}
      >
        <Form.Item name="title" label="Tên phần thưởng" rules={[{ required: true }]}>
          <Input placeholder="Ví dụ: Kem que" />
        </Form.Item>
        <Form.Item name="icon_emoji" label="Chọn icon dễ thương">
          <EmojiPicker options={REWARD_EMOJIS} />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="required_points" label="Mốc điểm mở khóa ⭐" rules={[{ required: true, type: 'number', min: 1 }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="stock" label="Số lượng (để trống = không giới hạn)">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="is_active" label="Đang bật" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saveMut.isPending}>Lưu</Button>
        <Button style={{ marginLeft: 8 }} onClick={() => navigate('/parent/rewards')}>Hủy</Button>
      </Form>
    </PageState>
  );
}
