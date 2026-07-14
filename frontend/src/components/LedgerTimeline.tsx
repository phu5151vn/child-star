import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import { List, Tag, theme, Typography } from 'antd';
import type { LedgerEntry } from '@/api/client';

const { Text } = Typography;

const kindLabels: Record<string, string> = {
  task_approved: 'Hoàn thành nhiệm vụ',
  reward_redeemed: 'Đổi thưởng',
  manual_adjust: 'Điều chỉnh',
};

interface LedgerTimelineProps {
  entries: LedgerEntry[];
}

export function LedgerTimeline({ entries }: LedgerTimelineProps) {
  const { token } = theme.useToken();

  return (
    <List
      dataSource={entries}
      renderItem={(entry) => {
        const isPositive = entry.delta > 0;
        const color = isPositive ? token.colorSuccess : token.colorError;
        const Icon = isPositive ? ArrowUpOutlined : entry.kind === 'manual_adjust' ? MinusOutlined : ArrowDownOutlined;

        return (
          <List.Item>
            <List.Item.Meta
              avatar={<Icon style={{ color, fontSize: 20 }} />}
              title={
                <SpaceInline>
                  <Tag color={isPositive ? 'success' : 'error'}>
                    {isPositive ? '+' : ''}
                    {entry.delta} sao
                  </Tag>
                  <Text>{kindLabels[entry.kind] ?? entry.kind}</Text>
                </SpaceInline>
              }
              description={
                <SpaceInline>
                  {entry.reason && <Text type="secondary">{entry.reason}</Text>}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(entry.created_at).toLocaleString('vi-VN')}
                  </Text>
                </SpaceInline>
              }
            />
          </List.Item>
        );
      }}
    />
  );
}

function SpaceInline({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</span>;
}
