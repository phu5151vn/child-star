import { StarFilled } from '@ant-design/icons';
import { Statistic, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { pointsAccent } from '@/theme/tokens';

interface PointsBadgeProps {
  balance: number;
  size?: 'small' | 'default' | 'large';
}

export function PointsBadge({ balance, size = 'default' }: PointsBadgeProps) {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const fontSize = size === 'large' ? 32 : size === 'small' ? 16 : 24;

  return (
    <Statistic
      value={balance}
      prefix={<StarFilled style={{ color: pointsAccent }} />}
      suffix={t('components:units.stars')}
      valueStyle={{
        color: token.colorPrimary,
        fontSize,
        fontFamily: '"Baloo 2", cursive',
        fontWeight: 700,
      }}
    />
  );
}
