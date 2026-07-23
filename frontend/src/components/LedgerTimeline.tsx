import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import { List, Tag, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { LedgerEntry } from '@/api/client';

const { Text } = Typography;

interface LedgerTimelineProps {
  entries: LedgerEntry[];
}

export function LedgerTimeline({ entries }: LedgerTimelineProps) {
  const { token } = theme.useToken();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
  const kindLabels: Record<string, string> = {
    task_approved: t('components:ledger.kind.task_approved'),
    reward_redeemed: t('components:ledger.kind.reward_redeemed'),
    manual_adjust: t('components:ledger.kind.manual_adjust'),
    weekly_bonus: t('components:ledger.kind.weekly_bonus'),
    streak_bonus: t('components:ledger.kind.streak_bonus'),
  };

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
                    {entry.delta} {t('components:units.stars')}
                  </Tag>
                  <Text>{kindLabels[entry.kind] ?? entry.kind}</Text>
                </SpaceInline>
              }
              description={
                <SpaceInline>
                  {entry.reason && <Text type="secondary">{entry.reason}</Text>}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(entry.created_at).toLocaleString(dateLocale)}
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
