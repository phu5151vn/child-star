import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Space, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type Task } from '@/api/client';
import { PageState } from '@/components/PageState';
import { TaskCard } from '@/components/TaskCard';

const { Title } = Typography;

export function ParentTasksPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<Task[]>('/tasks'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      message.success('Đã vô hiệu hóa nhiệm vụ');
    },
  });

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>📋 Quản lý nhiệm vụ</Title>
        <Button type="primary" shape="round" icon={<PlusOutlined />} onClick={() => navigate('/parent/tasks/new')}>
          Tạo mới
        </Button>
      </Space>
      <PageState isLoading={isLoading} isError={isError} isEmpty={!data?.length} onRetry={refetch} emptyDescription="Chưa có nhiệm vụ nào">
        <Space direction="vertical" className="bn-stagger" style={{ width: '100%' }} size="middle">
          {data?.map((task) => (
            <div key={task.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}><TaskCard task={task} /></div>
              <Button icon={<EditOutlined />} onClick={() => navigate(`/parent/tasks/${task.id}/edit`)} />
              <Popconfirm title="Vô hiệu hóa nhiệm vụ?" onConfirm={() => deleteMut.mutate(task.id)}>
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ))}
        </Space>
      </PageState>
    </>
  );
}
