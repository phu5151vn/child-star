import { Progress, Tag, theme, Typography } from 'antd';
import type { WeeklyProgress } from '@/api/client';

const { Text } = Typography;

interface WeeklyProgressCardProps {
  progress: WeeklyProgress;
  compact?: boolean;
}

/** Thanh tiến độ mục tiêu nhiệm vụ tuần + nhãn bonus. */
export function WeeklyProgressCard({ progress, compact }: WeeklyProgressCardProps) {
  const { token } = theme.useToken();
  if (!progress.enabled) return null;

  const percent = progress.target_count
    ? Math.min(100, Math.round((progress.completed / progress.target_count) * 100))
    : 0;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text strong style={{ fontSize: compact ? 13 : 15 }}>
          🎯 Mục tiêu tuần: {progress.completed}/{progress.target_count} nhiệm vụ
        </Text>
        {progress.bonus_earned ? (
          <Tag color="success" style={{ borderRadius: 999, margin: 0 }}>🏆 +{progress.bonus_points} bonus</Tag>
        ) : (
          <Tag color="gold" style={{ borderRadius: 999, margin: 0 }}>Thưởng +{progress.bonus_points} sao</Tag>
        )}
      </div>
      <Progress
        percent={percent}
        status={progress.achieved ? 'success' : 'active'}
        strokeColor={progress.achieved ? token.colorSuccess : { from: '#7c5cfc', to: '#ff8fc7' }}
        showInfo={false}
      />
      {!compact && (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {progress.achieved
            ? '🎉 Tuyệt vời! Con đã đạt mục tiêu tuần và nhận thưởng bonus!'
            : `Cố lên! Còn ${progress.remaining} nhiệm vụ nữa là nhận +${progress.bonus_points} sao bonus! 💪`}
        </Text>
      )}
    </div>
  );
}
