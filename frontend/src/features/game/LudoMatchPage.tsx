import { useEffect, useRef, useState } from 'react';
import { Button, Card, Space, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiClientError, type LudoMatch } from '@/api/client';
import { LudoBoard } from '@/components/LudoBoard';
import { LUDO_COLORS, LUDO_COLOR_KEYS } from '@/components/ludoConstants';
import { LudoDice } from '@/components/LudoDice';
import { PageState } from '@/components/PageState';
import { celebratePoints } from '@/components/CelebrationFx';
import { useAuth } from '@/features/auth/AuthContext';

const { Title, Text } = Typography;

function ColorDot({ color }: { color: number }) {
  return (
    <span
      style={{
        display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
        background: LUDO_COLORS[color], boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.25)',
      }}
    />
  );
}

export function LudoMatchPage() {
  const { id } = useParams();
  const { me } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const base = `/${me?.role ?? 'child'}/games`;
  const [spinKey, setSpinKey] = useState(0);
  const lastVer = useRef(0);
  const wonRef = useRef(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ludo', id],
    queryFn: () => api.get<LudoMatch>(`/ludo/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'finished' ? false : 2200),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ludo', id] });

  const joinMut = useMutation({
    mutationFn: () => api.post(`/ludo/${id}/join`),
    onSuccess: invalidate,
    onError: (e: Error) => message.error(e instanceof ApiClientError ? e.message : t('game:ludo.joinFail')),
  });
  const startMut = useMutation({
    mutationFn: () => api.post(`/ludo/${id}/start`),
    onSuccess: invalidate,
    onError: (e: Error) => message.error(e.message),
  });
  const rollMut = useMutation({
    mutationFn: () => api.post<LudoMatch>(`/ludo/${id}/roll`),
    onSuccess: (m) => {
      qc.setQueryData(['ludo', id], m);
      if (m.last?.type === 'no_move') message.info(t('game:ludo.noMoveSkip'));
      if (m.last?.type === 'burn_six') message.warning(t('game:ludo.burnSix'));
    },
    onError: (e: Error) => message.error(e.message),
  });
  const moveMut = useMutation({
    mutationFn: (token: number) => api.post<LudoMatch>(`/ludo/${id}/move`, { token }),
    onSuccess: (m) => {
      qc.setQueryData(['ludo', id], m);
      if (m.last?.captures?.length) {
        message.success(t('game:ludo.captured', { color: t(`components:ludo.color.${LUDO_COLOR_KEYS[m.last.captures[0].color]}`) }));
      }
    },
    onError: (e: Error) => message.error(e.message),
  });

  // Xoay xúc xắc mỗi khi có KẾT QUẢ GIEO mới (áp dụng cho mọi người xem, không chỉ người gieo).
  useEffect(() => {
    if (!data || data.version === lastVer.current) return;
    lastVer.current = data.version;
    if (data.last && ['roll', 'no_move', 'burn_six'].includes(data.last.type)) {
      setSpinKey((k) => k + 1);
    }
  }, [data?.version, data]);

  // Ăn mừng khi có người thắng.
  useEffect(() => {
    if (data?.status === 'finished' && !wonRef.current) {
      wonRef.current = true;
      celebratePoints();
    }
  }, [data?.status]);

  const yourColor = data?.players.find((p) => p.is_you)?.color ?? null;
  const displayDice = data?.dice ?? data?.last?.dice ?? null;

  return (
    <PageState isLoading={isLoading} isError={isError} onRetry={refetch}>
      {data && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Title level={4} style={{ margin: 0, fontFamily: '"Baloo 2", cursive' }}>{t('game:ludo.title')}</Title>
            <Button size="small" onClick={() => navigate(base)}>{t('game:common.backToLobby')}</Button>
          </Space>

          {/* Người chơi */}
          <Space wrap>
            {data.players.map((p) => (
              <Tag
                key={p.user_id}
                style={{ borderRadius: 999, padding: '4px 10px', borderColor: LUDO_COLORS[p.color] }}
                color={p.is_turn && data.status === 'active' ? undefined : 'default'}
              >
                <Space size={6}>
                  <ColorDot color={p.color} />
                  {p.name}{p.is_you ? ` ${t('game:common.you')}` : ''}
                  {p.is_turn && data.status === 'active' && <b>{t('game:ludo.turnMark')}</b>}
                </Space>
              </Tag>
            ))}
          </Space>

          {/* Phòng chờ */}
          {data.status === 'waiting' && (
            <Card style={{ borderRadius: 20, background: 'linear-gradient(135deg,#fff7e6,#eef4ff)' }}>
              <Space direction="vertical" style={{ width: '100%' }} align="center">
                <Text>{t('game:ludo.waitingPlayers', { count: data.players.length })}</Text>
                {!data.you_joined && data.free_slots > 0 && (
                  <Button type="primary" loading={joinMut.isPending} onClick={() => joinMut.mutate()}>
                    {t('game:ludo.joinMatch')}
                  </Button>
                )}
                {data.is_creator && (
                  <Button
                    type="primary"
                    size="large"
                    disabled={data.players.length < 2}
                    loading={startMut.isPending}
                    onClick={() => startMut.mutate()}
                  >
                    {data.players.length < 2 ? t('game:ludo.needTwo') : t('game:ludo.start')}
                  </Button>
                )}
              </Space>
            </Card>
          )}

          {/* Bàn cờ */}
          {(data.status === 'active' || data.status === 'finished') && (
            <>
              <LudoBoard
                players={data.players}
                movableTokens={data.movable_tokens}
                yourColor={yourColor}
                isYourTurn={data.is_your_turn}
                onPickToken={(t) => moveMut.mutate(t)}
              />

              {data.status === 'active' && (
                <Space direction="vertical" align="center" style={{ width: '100%' }}>
                  {!data.you_joined && data.free_slots > 0 && (
                    <Button onClick={() => joinMut.mutate()} loading={joinMut.isPending}>
                      {t('game:ludo.cutIn', { count: data.free_slots })}
                    </Button>
                  )}
                  <LudoDice
                    value={displayDice}
                    spinKey={spinKey}
                    disabled={!data.can_roll || rollMut.isPending}
                    onRoll={data.can_roll ? () => rollMut.mutate() : undefined}
                  />
                  {data.is_your_turn ? (
                    data.dice != null ? (
                      <Text strong style={{ color: '#7C5CFC' }}>
                        {data.movable_tokens.length ? t('game:ludo.pickToken') : t('game:ludo.noMoveHint')}
                      </Text>
                    ) : (
                      <Text strong style={{ color: '#7C5CFC' }}>{t('game:ludo.yourTurnRoll')}</Text>
                    )
                  ) : (
                    <Text type="secondary">
                      {t('game:ludo.waitFor', {
                        name: data.players.find((p) => p.is_turn)?.name ?? t('game:ludo.otherPlayer'),
                      })}
                    </Text>
                  )}
                </Space>
              )}

              {data.status === 'finished' && (
                <Card style={{ borderRadius: 20, textAlign: 'center', background: 'linear-gradient(135deg,#fff7e6,#fde9f0)' }}>
                  <div style={{ fontSize: 44 }}>🏆</div>
                  <Title level={4} style={{ margin: '6px 0' }}>
                    {t('game:ludo.winner', { name: data.winner_name })}
                  </Title>
                  <Button type="primary" onClick={() => navigate(base)}>{t('game:ludo.newMatch')}</Button>
                </Card>
              )}
            </>
          )}
        </Space>
      )}
    </PageState>
  );
}
