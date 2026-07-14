import { CheckCircleOutlined, StarFilled } from '@ant-design/icons';
import { Button, Card, Space, Tag, theme, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { Task } from '@/api/client';

const { Text, Title } = Typography;

interface TaskCardProps {
  task: Task;
  onClaim?: (taskId: string) => void;
  isChild?: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  available: { label: 'Chưa nhận', color: 'default' },
  in_progress: { label: 'Đang làm', color: 'processing' },
  submitted: { label: 'Chờ duyệt', color: 'warning' },
  approved: { label: 'Hoàn thành', color: 'success' },
  rejected: { label: 'Làm lại', color: 'error' },
};

export function TaskCard({ task, onClaim, isChild }: TaskCardProps) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const status = task.assignment_status ?? 'available';
  const statusInfo = statusLabels[status] ?? statusLabels.available;

  return (
    <Card
      hoverable={isChild && status === 'available'}
      style={{ borderRadius: token.borderRadiusLG }}
      onClick={() => {
        if (isChild && task.assignment_id) navigate(`/child/tasks/${task.id}`);
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Title level={isChild ? 4 : 5} style={{ margin: 0 }}>
            {task.title}
          </Title>
          <Tag icon={<StarFilled />} color="gold">
            +{task.points} sao
          </Tag>
        </Space>
        {task.description && <Text type="secondary">{task.description}</Text>}
        {isChild ? (
          <Space>
            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
            {status === 'available' && onClaim && (
              <Button type="primary" size="small" onClick={() => onClaim(task.id)}>
                Nhận nhiệm vụ
              </Button>
            )}
            {(status === 'in_progress' || status === 'submitted') && (
              <Button type="link" size="small" onClick={() => navigate(`/child/tasks/${task.id}`)}>
                Xem chi tiết
              </Button>
            )}
            {status === 'approved' && <CheckCircleOutlined style={{ color: token.colorSuccess }} />}
          </Space>
        ) : (
          <Tag color={task.is_active ? 'success' : 'default'}>
            {task.is_active ? 'Đang bật' : 'Đã tắt'}
          </Tag>
        )}
      </Space>
    </Card>
  );
}
