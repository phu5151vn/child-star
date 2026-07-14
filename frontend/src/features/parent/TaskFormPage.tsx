import { Button, Form, Input, InputNumber, Switch, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Task } from '@/api/client';
import { MediaUpload } from '@/components/MediaUpload';
import { PageState } from '@/components/PageState';

const { Title } = Typography;

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
        style={{ maxWidth: 480, marginTop: 24 }}
        initialValues={{ require_proof: false, is_active: true, points: 10 }}
        onFinish={(v) => saveMut.mutate(v)}
      >
        <Form.Item name="title" label="Tên nhiệm vụ" rules={[{ required: true, max: 80 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="points" label="Điểm thưởng (sao)" rules={[{ required: true, type: 'number', min: 1 }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="icon_media_id" label="Ảnh nhiệm vụ">
          <MediaUpload kind="task_icon" />
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
