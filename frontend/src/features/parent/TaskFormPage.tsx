import { Button, Form, Input, InputNumber, Segmented, Switch, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Task } from '@/api/client';
import { EmojiPicker } from '@/components/EmojiPicker';
import { PageState } from '@/components/PageState';
import { RECURRENCE_OPTIONS, TASK_EMOJIS } from '@/theme/cute';

const { Title, Text } = Typography;

export function TaskFormPage() {
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
      message.success(isEdit ? 'Đã cập nhật' : 'Đã tạo nhiệm vụ');
      navigate('/parent/tasks');
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <PageState isLoading={isEdit && isLoading}>
      <Title level={3}>{isEdit ? 'Sửa nhiệm vụ' : 'Tạo nhiệm vụ mới'}</Title>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 520, marginTop: 24 }}
        initialValues={{ require_proof: false, is_active: true, points: 10, recurrence: 'once', icon_emoji: '⭐' }}
        onFinish={(v) => saveMut.mutate(v)}
      >
        <Form.Item name="title" label="Tên nhiệm vụ" rules={[{ required: true, max: 80 }]}>
          <Input placeholder="Ví dụ: Dọn phòng" />
        </Form.Item>
        <Form.Item name="icon_emoji" label="Chọn icon dễ thương">
          <EmojiPicker options={TASK_EMOJIS} />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="points" label="Điểm thưởng (sao) ⭐" rules={[{ required: true, type: 'number', min: 1 }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="recurrence"
          label="Lặp lại"
          extra={<Text type="secondary">Nhiệm vụ lặp lại sẽ tự mở lại cho con sau mỗi ngày/tuần, không cần tạo mới.</Text>}
        >
          <Segmented options={RECURRENCE_OPTIONS} />
        </Form.Item>
        <Form.Item name="require_proof" label="Yêu cầu ảnh minh chứng" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="is_active" label="Đang bật" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saveMut.isPending}>
          Lưu
        </Button>
        <Button style={{ marginLeft: 8 }} onClick={() => navigate('/parent/tasks')}>
          Hủy
        </Button>
      </Form>
    </PageState>
  );
}
