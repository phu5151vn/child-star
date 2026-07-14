import { GiftOutlined, LockOutlined, StarFilled } from '@ant-design/icons';
import { Button, Card, Space, Tag, theme, Typography } from 'antd';
import type { Reward } from '@/api/client';
import { lockedColor } from '@/theme/tokens';
import { PointsProgress } from './PointsProgress';

const { Text, Title } = Typography;

interface RewardCardProps {
  reward: Reward;
  balance?: number;
  onRedeem?: (rewardId: string) => void;
  isChild?: boolean;
}

export function RewardCard({ reward, balance = 0, onRedeem, isChild }: RewardCardProps) {
  const { token } = theme.useToken();
  const isLocked = isChild && !reward.is_unlocked;
  const isOutOfStock = reward.is_out_of_stock;

  return (
    <Card
      style={{
        borderRadius: token.borderRadiusLG,
        opacity: isLocked ? 0.85 : 1,
        background: isLocked ? token.colorFillAlter : token.colorBgContainer,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isLocked && (
        <div
          style={{
            position: 'absolute',
            top: token.paddingSM,
            right: token.paddingSM,
            color: lockedColor,
            fontSize: 24,
          }}
        >
          <LockOutlined />
        </div>
      )}
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space>
          <GiftOutlined style={{ fontSize: 28, color: token.colorPrimary }} />
          <Title level={isChild ? 4 : 5} style={{ margin: 0 }}>
            {reward.title}
          </Title>
        </Space>
        {reward.description && <Text type="secondary">{reward.description}</Text>}
        <Tag icon={<StarFilled />} color="gold">
          {reward.required_points} sao
        </Tag>
        {isChild && isLocked && reward.missing_points != null && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">Còn thiếu {reward.missing_points} sao</Text>
            <PointsProgress current={balance} target={reward.required_points} />
          </Space>
        )}
        {isChild && !isLocked && !isOutOfStock && onRedeem && (
          <Button type="primary" block onClick={() => onRedeem(reward.id)}>
            Đổi ngay
          </Button>
        )}
        {isOutOfStock && <Tag color="default">Hết hàng</Tag>}
      </Space>
    </Card>
  );
}
