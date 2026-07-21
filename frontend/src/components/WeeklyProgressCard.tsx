import { Progress, Tag, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { WeeklyProgress } from '@/api/client';

const { Text } = Typography;

interface WeeklyProgressCardProps {
  progress: WeeklyProgress;
  compact?: boolean;
}

/** Thanh tiến độ mục tiêu nhiệm vụ tuần + nhãn bonus. */
export function WeeklyProgressCard({ progress, compact }: WeeklyProgressCardProps) {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  if (!progress.enabled) return null;

  const percent = progress.target_count
    ? Math.min(100, Math.round((progress.completed / progress.target_count) * 100))
    : 0;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text strong style={{ fontSize: compact ? 13 : 15 }}>
          {t('components:weeklyProgress.goal', { completed: progress.completed, target: progress.target_count })}
        </Text>
        {progress.bonus_earned ? (
          <Tag color="success" style={{ borderRadius: 999, margin: 0 }}>
            {t('components:weeklyProgress.bonusEarned', { points: progress.bonus_points })}
          </Tag>
        ) : (
          <Tag color="gold" style={{ borderRadius: 999, margin: 0 }}>
            {t('components:weeklyProgress.bonusTag', { points: progress.bonus_points })}
          </Tag>
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
            ? t('components:weeklyProgress.achieved')
            : t('components:weeklyProgress.remaining', { remaining: progress.remaining, points: progress.bonus_points })}
        </Text>
      )}
    </div>
  );
}
