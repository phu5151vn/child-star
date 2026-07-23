import { CheckCircleFilled, StarFilled } from '@ant-design/icons';
import { Button, Card, Space, Tag, theme, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Task } from '@/api/client';
import { EmojiIcon } from '@/components/CuteBits';
import { defaultTaskEmoji, RECURRENCE_META, type Recurrence } from '@/theme/cute';

const { Text, Title } = Typography;

interface TaskCardProps {
  task: Task;
  onClaim?: (taskId: string) => void;
  isChild?: boolean;
}

const statusColors: Record<string, string> = {
  available: 'default',
  in_progress: 'processing',
  submitted: 'warning',
  approved: 'success',
  rejected: 'error',
};

export function TaskCard({ task, onClaim, isChild }: TaskCardProps) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const status = task.assignment_status ?? 'available';
  const statusKey = statusColors[status] ? status : 'available';
  const statusInfo = { label: t(`components:taskCard.status.${statusKey}`), color: statusColors[statusKey] };
  const emoji = task.icon_emoji || defaultTaskEmoji(task.title);
  const rec = RECURRENCE_META[(task.recurrence ?? 'once') as Recurrence];
  const clickable = isChild && !!task.assignment_id;

  return (
    <Card
      className="bn-card-hover"
      hoverable={isChild && status === 'available'}
      styles={{ body: { padding: 16 } }}
      style={{ borderRadius: token.borderRadiusLG, cursor: clickable ? 'pointer' : 'default' }}
      onClick={() => {
        if (clickable) navigate(`/child/tasks/${task.id}`);
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <EmojiIcon emoji={emoji} size={isChild ? 58 : 48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }} align="start">
            <Title level={isChild ? 4 : 5} style={{ margin: 0 }}>
              {task.title}
            </Title>
            <Tag icon={<StarFilled />} color="gold" style={{ borderRadius: 999, fontWeight: 700, margin: 0 }}>
              +{task.points} {t('components:units.stars')}
            </Tag>
          </Space>
          {task.description && (
            <Text type="secondary" style={{ display: 'block', marginTop: 2 }}>
              {task.description}
            </Text>
          )}
          <Space size={[6, 6]} wrap style={{ marginTop: 10 }}>
            {rec && (
              <Tag color={rec.color} style={{ borderRadius: 999, margin: 0 }}>
                {task.recurrence !== 'once' ? `${rec.emoji} ` : ''}
                {rec.short}
              </Tag>
            )}
            {isChild ? (
              <>
                <Tag color={statusInfo.color} style={{ borderRadius: 999, margin: 0 }}>
                  {statusInfo.label}
                </Tag>
                {status === 'available' && onClaim && (
                  <Button
                    type="primary"
                    size="small"
                    shape="round"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClaim(task.id);
                    }}
                  >
                    {t('components:taskCard.claim')}
                  </Button>
                )}
                {(status === 'in_progress' || status === 'submitted') && (
                  <Button type="link" size="small" onClick={() => navigate(`/child/tasks/${task.id}`)}>
                    {t('components:taskCard.viewDetail')}
                  </Button>
                )}
                {status === 'approved' && (
                  <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 20 }} />
                )}
              </>
            ) : (
              <Tag color={task.is_active ? 'success' : 'default'} style={{ borderRadius: 999, margin: 0 }}>
                {task.is_active ? t('components:taskCard.active') : t('components:taskCard.inactive')}
              </Tag>
            )}
          </Space>
          {isChild && status === 'approved' && (task.recurrence === 'daily' || task.recurrence === 'weekly') && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              {t(task.recurrence === 'daily' ? 'components:taskCard.doneDaily' : 'components:taskCard.doneWeekly')}
            </Text>
          )}
        </div>
      </div>
    </Card>
  );
}
