import { Space, Tag, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { StreakInfo } from '@/api/client';

const { Text, Title } = Typography;

interface StreakFlameProps {
  streak: StreakInfo;
}

/** Ngọn lửa chuỗi ngày: 🔥 + số ngày + mốc kế; streak=0 mời bắt đầu. */
export function StreakFlame({ streak }: StreakFlameProps) {
  const { token } = theme.useToken();
  const { t } = useTranslation();

  if (streak.current <= 0) {
    return (
      <Space direction="vertical" align="center" size={6} style={{ width: '100%' }}>
        <div style={{ fontSize: 52, filter: 'grayscale(0.6)', opacity: 0.7 }} role="img" aria-hidden>
          🔥
        </div>
        <Title level={4} style={{ margin: 0, fontFamily: '"Baloo 2", cursive' }}>
          {t('child:journey.streakStartTitle')}
        </Title>
        <Text type="secondary" style={{ textAlign: 'center' }}>
          {t('child:journey.streakStartHint')}
        </Text>
      </Space>
    );
  }

  return (
    <Space direction="vertical" align="center" size={6} style={{ width: '100%' }}>
      <div className="bn-float" style={{ fontSize: 56, lineHeight: 1 }} role="img" aria-hidden>
        🔥
      </div>
      <Title level={2} style={{ margin: 0, fontFamily: '"Baloo 2", cursive', color: '#ff7a45' }}>
        {t('child:journey.streakDays', { count: streak.current })}
      </Title>
      {streak.active_today ? (
        <Tag color="success" style={{ borderRadius: 999, margin: 0 }}>
          {t('child:journey.streakActiveToday')}
        </Tag>
      ) : (
        <Tag color="warning" style={{ borderRadius: 999, margin: 0 }}>
          {t('child:journey.streakKeepToday')}
        </Tag>
      )}
      <Text type="secondary" style={{ textAlign: 'center' }}>
        {streak.next_milestone != null && streak.days_to_next != null
          ? t('child:journey.streakToMilestone', {
              days: streak.days_to_next,
              milestone: streak.next_milestone,
            })
          : t('child:journey.streakAllMilestones')}
      </Text>
      <Text style={{ fontSize: 13, color: token.colorTextTertiary }}>
        {t('child:journey.streakLongest', { count: streak.longest })}
      </Text>
    </Space>
  );
}
