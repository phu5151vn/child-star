import { Button, Card, List, Space, Switch, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { api, ApiClientError, type GameMatch, type GameSummary, type GameType } from '@/api/client';
import { PageState } from '@/components/PageState';
import { useAuth } from '@/features/auth/AuthContext';

const { Title, Text } = Typography;

export function GameLobbyPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const base = `/${me?.role ?? 'child'}/games`;
  const [caroBlock, setCaroBlock] = useState(false);

  const { data: games, isLoading, isError, refetch } = useQuery({
    queryKey: ['games'],
    queryFn: () => api.get<GameSummary[]>('/games'),
    refetchInterval: 4000,
  });

  const createMut = useMutation({
    mutationFn: (payload: { game_type: GameType; caro_block_two_ends: boolean }) =>
      api.post<GameMatch>('/games', { ...payload, side: 'random' }),
    onSuccess: (m) => {
      void qc.invalidateQueries({ queryKey: ['games'] });
      navigate(`${base}/${m.id}`);
    },
    onError: (e: Error) => message.error(e.message),
  });

  const joinMut = useMutation({
    mutationFn: (id: string) => api.post<GameMatch>(`/games/${id}/join`),
    onSuccess: (m) => navigate(`${base}/${m.id}`),
    onError: (e: Error) =>
      message.error(e instanceof ApiClientError ? e.message : 'Không tham gia được ván'),
  });

  const waiting = games?.filter((g) => g.status === 'waiting' && !g.is_yours) ?? [];
  const mine = games?.filter((g) => g.is_yours && g.status !== 'finished') ?? [];

  const partnerLabel = me?.role === 'child' ? 'bố mẹ' : 'con';

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }} className="bn-stagger">
      <div style={{ textAlign: 'center' }}>
        <div className="bn-float" style={{ fontSize: 40 }}>🎮</div>
        <Title level={3} style={{ fontFamily: '"Baloo 2", cursive', margin: '4px 0 0' }}>
          Chơi game cùng {partnerLabel}
        </Title>
        <Text type="secondary">Cờ caro & cờ vua — online hoặc chung một máy</Text>
      </div>

      <GameCard
        type="caro"
        title="Cờ Caro"
        emoji="⭕"
        gradient="linear-gradient(135deg,#fef6e4,#fde9f0)"
        desc="Nối 5 quân thành hàng để thắng!"
        onOnline={() => createMut.mutate({ game_type: 'caro', caro_block_two_ends: caroBlock })}
        onLocal={() => navigate(`${base}/local/caro${caroBlock ? '?block=1' : ''}`)}
        loading={createMut.isPending}
        partnerLabel={partnerLabel}
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Switch checked={caroBlock} onChange={setCaroBlock} size="small" />
            <Text style={{ fontSize: 13 }}>Chặn 2 đầu</Text>
          </div>
        }
      />

      <GameCard
        type="chess"
        title="Cờ Vua"
        emoji="♟️"
        gradient="linear-gradient(135deg,#eef0ff,#f6ecff)"
        desc="Luật đầy đủ: nhập thành, phong hậu, chiếu bí."
        onOnline={() => createMut.mutate({ game_type: 'chess', caro_block_two_ends: false })}
        onLocal={() => navigate(`${base}/local/chess`)}
        loading={createMut.isPending}
        partnerLabel={partnerLabel}
      />

      <Card title="🎯 Ván đang chờ trong nhà" style={{ borderRadius: 20 }}>
        <PageState
          isLoading={isLoading}
          isError={isError}
          isEmpty={waiting.length === 0 && mine.length === 0}
          emptyDescription="Chưa có ván nào. Tạo ván mới ở trên nhé!"
          onRetry={refetch}
          skeletonRows={2}
        >
          <List
            dataSource={[...mine, ...waiting]}
            renderItem={(g) => (
              <List.Item
                actions={[
                  g.is_yours ? (
                    <Button key="resume" type="link" onClick={() => navigate(`${base}/${g.id}`)}>
                      Quay lại
                    </Button>
                  ) : (
                    <Button
                      key="join"
                      type="primary"
                      size="small"
                      loading={joinMut.isPending}
                      onClick={() => joinMut.mutate(g.id)}
                    >
                      Tham gia
                    </Button>
                  ),
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Icon
                      icon={g.game_type === 'chess' ? 'game-icons:chess-knight' : 'game-icons:tic-tac-toe'}
                      width={28}
                      style={{ color: '#7C5CFC' }}
                    />
                  }
                  title={
                    <Space>
                      {g.game_type === 'chess' ? 'Cờ Vua' : 'Cờ Caro'}
                      {g.is_yours && <Tag color="purple">Của bạn</Tag>}
                      {g.status === 'active' && <Tag color="green">Đang chơi</Tag>}
                    </Space>
                  }
                  description={`Chủ ván: ${g.host_name ?? '—'}`}
                />
              </List.Item>
            )}
          />
        </PageState>
      </Card>
    </Space>
  );
}

interface GameCardProps {
  type: GameType;
  title: string;
  emoji: string;
  gradient: string;
  desc: string;
  onOnline: () => void;
  onLocal: () => void;
  loading?: boolean;
  partnerLabel: string;
  extra?: React.ReactNode;
}

function GameCard({ title, emoji, gradient, desc, onOnline, onLocal, loading, partnerLabel, extra }: GameCardProps) {
  return (
    <Card className="bn-card-hover" style={{ borderRadius: 24, background: gradient, border: 'none' }}>
      <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space direction="vertical" size={2}>
          <Title level={4} style={{ margin: 0, fontFamily: '"Baloo 2", cursive' }}>
            {emoji} {title}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {desc}
          </Text>
          {extra}
        </Space>
      </Space>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <Button type="primary" size="large" loading={loading} onClick={onOnline}>
          Chơi online với {partnerLabel}
        </Button>
        <Button size="large" onClick={onLocal}>
          Chơi chung 1 máy
        </Button>
      </div>
    </Card>
  );
}
