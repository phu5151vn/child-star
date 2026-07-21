import { Button, Card, List, Space, Switch, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { api, ApiClientError, type GameMatch, type GameSummary, type GameType, type LudoMatch, type LudoSummary } from '@/api/client';
import { PageState } from '@/components/PageState';
import { useAuth } from '@/features/auth/AuthContext';

const { Title, Text } = Typography;

export function GameLobbyPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
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
      message.error(e instanceof ApiClientError ? e.message : t('game:match.joinFail')),
  });

  const { data: ludoGames } = useQuery({
    queryKey: ['ludo'],
    queryFn: () => api.get<LudoSummary[]>('/ludo'),
    refetchInterval: 4000,
  });

  const createLudoMut = useMutation({
    mutationFn: () => api.post<LudoMatch>('/ludo'),
    onSuccess: (m) => navigate(`/${me?.role ?? 'child'}/ludo/${m.id}`),
    onError: (e: Error) => message.error(e.message),
  });

  const openLudo = (id: string) => navigate(`/${me?.role ?? 'child'}/ludo/${id}`);
  const joinLudoMut = useMutation({
    mutationFn: (id: string) => api.post<LudoMatch>(`/ludo/${id}/join`),
    onSuccess: (m) => openLudo(m.id),
    onError: (e: Error) => message.error(e instanceof ApiClientError ? e.message : t('game:ludo.joinFail')),
  });

  const waiting = games?.filter((g) => g.status === 'waiting' && !g.is_yours) ?? [];
  const mine = games?.filter((g) => g.is_yours && g.status !== 'finished') ?? [];
  const ludoList = ludoGames ?? [];

  const partnerLabel = me?.role === 'child' ? t('game:lobby.partnerParents') : t('game:lobby.partnerChild');

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }} className="bn-stagger">
      <div style={{ textAlign: 'center' }}>
        <div className="bn-float" style={{ fontSize: 40 }}>🎮</div>
        <Title level={3} style={{ fontFamily: '"Baloo 2", cursive', margin: '4px 0 0' }}>
          {t('game:lobby.heading', { partner: partnerLabel })}
        </Title>
        <Text type="secondary">{t('game:lobby.subtitle')}</Text>
      </div>

      <GameCard
        type="caro"
        title={t('game:caro.name')}
        emoji="⭕"
        gradient="linear-gradient(135deg,#fef6e4,#fde9f0)"
        desc={t('game:lobby.caroDesc')}
        onOnline={() => createMut.mutate({ game_type: 'caro', caro_block_two_ends: caroBlock })}
        onLocal={() => navigate(`${base}/local/caro${caroBlock ? '?block=1' : ''}`)}
        loading={createMut.isPending}
        partnerLabel={partnerLabel}
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Switch checked={caroBlock} onChange={setCaroBlock} size="small" />
            <Text style={{ fontSize: 13 }}>{t('game:caro.blockTwoEnds')}</Text>
          </div>
        }
      />

      <GameCard
        type="chess"
        title={t('game:chess.name')}
        emoji="♟️"
        gradient="linear-gradient(135deg,#eef0ff,#f6ecff)"
        desc={t('game:lobby.chessDesc')}
        onOnline={() => createMut.mutate({ game_type: 'chess', caro_block_two_ends: false })}
        onLocal={() => navigate(`${base}/local/chess`)}
        loading={createMut.isPending}
        partnerLabel={partnerLabel}
      />

      <Card className="bn-card-hover" style={{ borderRadius: 24, background: 'linear-gradient(135deg,#fff1f0,#e8fff3)', border: 'none' }}>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space direction="vertical" size={2}>
            <Title level={4} style={{ margin: 0, fontFamily: '"Baloo 2", cursive' }}>{t('game:ludo.title')}</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('game:ludo.lobbyDesc')}
            </Text>
          </Space>
        </Space>
        <div style={{ marginTop: 16 }}>
          <Button type="primary" size="large" loading={createLudoMut.isPending} onClick={() => createLudoMut.mutate()}>
            {t('game:ludo.create')}
          </Button>
        </div>
        {ludoList.length > 0 && (
          <List
            style={{ marginTop: 12 }}
            dataSource={ludoList}
            renderItem={(g) => (
              <List.Item
                actions={[
                  g.is_yours ? (
                    <Button key="resume" type="link" onClick={() => openLudo(g.id)}>{t('action.back')}</Button>
                  ) : (
                    <Button
                      key="join"
                      type="primary"
                      size="small"
                      loading={joinLudoMut.isPending}
                      onClick={() => joinLudoMut.mutate(g.id)}
                    >
                      {g.status === 'active' ? t('game:ludo.cutInShort') : t('game:common.join')}
                    </Button>
                  ),
                ]}
              >
                <List.Item.Meta
                  avatar={<span style={{ fontSize: 24 }}>🐴</span>}
                  title={
                    <Space wrap size={[6, 2]}>
                      <span style={{ whiteSpace: 'nowrap' }}>{t('game:ludo.listItem', { count: g.player_count })}</span>
                      {g.is_yours && <Tag color="purple" style={{ marginInlineEnd: 0 }}>{t('game:common.yours')}</Tag>}
                      {g.status === 'active'
                        ? <Tag color="green" style={{ marginInlineEnd: 0 }}>{t('game:common.playing')}</Tag>
                        : <Tag color="orange" style={{ marginInlineEnd: 0 }}>{t('game:common.waiting')}</Tag>}
                    </Space>
                  }
                  description={g.player_names.join(', ') || '—'}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card title={t('game:lobby.waitingSection')} style={{ borderRadius: 20 }}>
        <PageState
          isLoading={isLoading}
          isError={isError}
          isEmpty={waiting.length === 0 && mine.length === 0}
          emptyDescription={t('game:lobby.empty')}
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
                      {t('action.back')}
                    </Button>
                  ) : (
                    <Button
                      key="join"
                      type="primary"
                      size="small"
                      loading={joinMut.isPending}
                      onClick={() => joinMut.mutate(g.id)}
                    >
                      {t('game:common.join')}
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
                    <Space wrap size={[6, 2]}>
                      <span style={{ whiteSpace: 'nowrap' }}>{g.game_type === 'chess' ? t('game:chess.name') : t('game:caro.name')}</span>
                      {g.is_yours && <Tag color="purple" style={{ marginInlineEnd: 0 }}>{t('game:common.yours')}</Tag>}
                      {g.status === 'active' && <Tag color="green" style={{ marginInlineEnd: 0 }}>{t('game:common.playing')}</Tag>}
                    </Space>
                  }
                  description={t('game:lobby.host', { name: g.host_name ?? '—' })}
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
  const { t } = useTranslation();
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
          {t('game:lobby.playOnline', { partner: partnerLabel })}
        </Button>
        <Button size="large" onClick={onLocal}>
          {t('game:lobby.playLocal')}
        </Button>
      </div>
    </Card>
  );
}
