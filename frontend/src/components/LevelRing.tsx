import { Progress, Space, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { LevelInfo } from '@/api/client';

const { Text, Title } = Typography;

interface LevelRingProps {
  level: LevelInfo;
  size?: number;
}

/** Vòng cấp độ: icon + Lv + danh hiệu + % tới cấp kế + "còn N sao". */
export function LevelRing({ level, size = 148 }: LevelRingProps) {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const isMax = level.next_min == null || level.points_to_next <= 0;
  const percent = isMax ? 100 : Math.max(0, Math.min(100, Math.round(level.progress_pct)));

  return (
    <Space direction="vertical" align="center" style={{ width: '100%' }} size={8}>
      <Progress
        type="circle"
        percent={percent}
        size={size}
        strokeColor={{ '0%': '#7c5cfc', '100%': '#ff8fc7' }}
        trailColor={token.colorFillSecondary}
        strokeWidth={9}
        format={() => (
          <Space direction="vertical" size={0} align="center">
            <span className="bn-float" style={{ fontSize: Math.round(size * 0.3), lineHeight: 1 }} role="img" aria-hidden>
              {level.icon}
            </span>
            <Text strong style={{ fontFamily: '"Baloo 2", cursive', fontSize: 16, color: token.colorPrimary }}>
              {t('child:journey.levelShort', { level: level.level })}
            </Text>
          </Space>
        )}
      />
      <Title level={4} style={{ margin: 0, fontFamily: '"Baloo 2", cursive' }}>
        {level.title}
      </Title>
      <Text type="secondary" style={{ textAlign: 'center' }}>
        {isMax
          ? t('child:journey.levelMax')
          : t('child:journey.levelToNext', { count: level.points_to_next })}
      </Text>
    </Space>
  );
}
