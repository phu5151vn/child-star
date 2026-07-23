import { LockOutlined } from '@ant-design/icons';
import { Progress, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { BadgeInfo } from '@/api/client';
import { lockedColor } from '@/theme/tokens';

const { Text } = Typography;

interface BadgeCardProps {
  badge: BadgeInfo;
}

/** Ô huy hiệu: đạt sáng màu / chưa đạt mờ + 🔒 + tiến độ "còn N nữa". */
export function BadgeCard({ badge }: BadgeCardProps) {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const earned = badge.earned;
  const remaining =
    badge.threshold != null && badge.current != null ? Math.max(0, badge.threshold - badge.current) : null;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '16px 12px',
        borderRadius: token.borderRadiusLG,
        textAlign: 'center',
        background: earned ? 'linear-gradient(135deg,#fff7e6,#fdeef7)' : token.colorFillAlter,
        border: `1.5px solid ${earned ? token.colorWarning : token.colorBorderSecondary}`,
        opacity: earned ? 1 : 0.92,
        overflow: 'hidden',
      }}
    >
      {!earned && (
        <div style={{ position: 'absolute', top: 8, right: 8, color: lockedColor, fontSize: 16 }}>
          <LockOutlined />
        </div>
      )}
      <div
        className={earned ? 'bn-float' : undefined}
        style={{
          fontSize: 40,
          lineHeight: 1,
          filter: earned ? 'none' : 'grayscale(0.9)',
          opacity: earned ? 1 : 0.55,
        }}
        role="img"
        aria-hidden
      >
        {badge.icon}
      </div>
      <Text strong style={{ fontSize: 14 }}>
        {badge.title}
      </Text>
      <Text type="secondary" style={{ fontSize: 12, minHeight: 32 }}>
        {badge.description}
      </Text>
      {earned ? (
        <Text style={{ fontSize: 12, color: token.colorSuccess, fontWeight: 700 }}>
          {t('child:journey.badgeEarned')}
        </Text>
      ) : (
        <div style={{ width: '100%', marginTop: 2 }}>
          <Progress
            percent={Math.max(0, Math.min(100, Math.round(badge.progress_pct)))}
            size="small"
            strokeColor={token.colorPrimary}
            trailColor={token.colorFillSecondary}
            showInfo={false}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {remaining != null
              ? t('child:journey.badgeRemaining', { count: remaining })
              : t('child:journey.badgeLocked')}
          </Text>
        </div>
      )}
    </div>
  );
}
