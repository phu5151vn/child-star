import { ClockCircleOutlined, LockOutlined, StarFilled } from '@ant-design/icons';
import { Button, Card, Space, Tag, theme, Typography } from 'antd';
import type { Reward } from '@/api/client';
import { EmojiIcon } from '@/components/CuteBits';
import { defaultRewardEmoji } from '@/theme/cute';
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
  const isPending = !!(isChild && reward.is_pending);
  const isLocked = isChild && !reward.is_unlocked && !isPending;
  const isOutOfStock = reward.is_out_of_stock;
  const dimmed = isLocked || isPending;
  const emoji = reward.icon_emoji || defaultRewardEmoji(reward.title);

  return (
    <Card
      className="bn-card-hover"
      styles={{ body: { padding: 16 } }}
      style={{
        borderRadius: token.borderRadiusLG,
        opacity: dimmed ? 0.9 : 1,
        background: dimmed ? token.colorFillAlter : token.colorBgContainer,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isPending ? (
        <div style={{ position: 'absolute', top: 12, right: 12, color: token.colorWarning, fontSize: 22 }}>
          <ClockCircleOutlined />
        </div>
      ) : isLocked ? (
        <div style={{ position: 'absolute', top: 12, right: 12, color: lockedColor, fontSize: 22 }}>
          <LockOutlined />
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <EmojiIcon emoji={emoji} size={isChild ? 58 : 48} className={dimmed ? undefined : 'bn-float'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Title level={isChild ? 4 : 5} style={{ margin: 0 }}>
            {reward.title}
          </Title>
          {reward.description && (
            <Text type="secondary" style={{ display: 'block', marginTop: 2 }}>
              {reward.description}
            </Text>
          )}
          <div style={{ marginTop: 10 }}>
            <Tag icon={<StarFilled />} color="gold" style={{ borderRadius: 999, fontWeight: 700 }}>
              {reward.required_points} sao
            </Tag>
            {isPending && (
              <Tag icon={<ClockCircleOutlined />} color="orange" style={{ borderRadius: 999, fontWeight: 700 }}>
                Đang chờ duyệt
              </Tag>
            )}
            {isOutOfStock && <Tag color="default" style={{ borderRadius: 999 }}>Hết hàng</Tag>}
          </div>
          {isPending && (
            <Text type="secondary" style={{ display: 'block', marginTop: 10 }}>
              Con đã gửi yêu cầu đổi, đang chờ bố mẹ duyệt nhé! ⏳
            </Text>
          )}
          {isChild && isLocked && reward.missing_points != null && (
            <Space direction="vertical" style={{ width: '100%', marginTop: 10 }}>
              <Text type="secondary">Còn thiếu {reward.missing_points} sao nữa nhé! 💪</Text>
              <PointsProgress current={balance} target={reward.required_points} />
            </Space>
          )}
          {isChild && !isLocked && !isPending && !isOutOfStock && onRedeem && (
            <Button type="primary" block shape="round" style={{ marginTop: 12 }} onClick={() => onRedeem(reward.id)}>
              Đổi ngay 🎉
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
