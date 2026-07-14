import { Progress, theme } from 'antd';
import { pointsAccent } from '@/theme/tokens';

interface PointsProgressProps {
  current: number;
  target: number;
  showInfo?: boolean;
}

export function PointsProgress({ current, target, showInfo = true }: PointsProgressProps) {
  const { token } = theme.useToken();
  const percent = Math.min(100, Math.round((current / target) * 100));

  return (
    <Progress
      percent={percent}
      strokeColor={pointsAccent}
      trailColor={token.colorFillSecondary}
      format={() => (showInfo ? `${current}/${target} ⭐` : undefined)}
    />
  );
}
