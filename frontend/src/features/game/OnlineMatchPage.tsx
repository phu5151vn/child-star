import { Button, Card, Space, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  api,
  ApiClientError,
  type CaroState,
  type ChessState,
  type GameMatch,
  type Side,
} from '@/api/client';
import { PageState } from '@/components/PageState';
import { ChildAvatar } from '@/components/CuteBits';
import { useAuth } from '@/features/auth/AuthContext';
import { CaroBoard } from './components/CaroBoard';
import { ChessBoard } from './components/ChessBoard';
import { GameResultOverlay, type ResultKind } from './components/GameResultOverlay';
import type { AppliedMove } from './hooks/useChessGame';

const { Text } = Typography;

export function OnlineMatchPage() {
  const { id = '' } = useParams();
  const { me } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const base = `/${me?.role ?? 'child'}/games`;

  const { data: match, isLoading, isError, refetch } = useQuery({
    queryKey: ['game', id],
    queryFn: () => api.get<GameMatch>(`/games/${id}`),
    // Giữ dữ liệu ván trong 30 phút để khi app bị đưa xuống nền (mobile) quay lại không phải
    // tải trắng lại từ đầu (tránh skeleton nhảy + mất vị trí cuộn).
    gcTime: 30 * 60 * 1000,
    refetchInterval: (query) => {
      const m = query.state.data as GameMatch | undefined;
      if (!m) return 1500;
      if (m.status === 'finished' || m.status === 'abandoned') return false;
      if (m.status === 'waiting') return 2000;
      // active: poll nhanh khi chờ đối thủ đi hoặc có lời mời đang chờ; vẫn poll chậm khi
      // tới lượt mình để kịp nhận lời mời cầu hòa/xin đi lại từ đối thủ.
      if (m.pending_offer) return 1000;
      return m.is_your_turn ? 2500 : 1200;
    },
  });

  const moveMut = useMutation({
    mutationFn: (payload: { move: string; resulting_fen?: string; result?: string }) =>
      api.post<GameMatch>(`/games/${id}/move`, payload),
    onSuccess: (m) => qc.setQueryData(['game', id], m),
    onError: (e: Error) => {
      message.error(e instanceof ApiClientError ? e.message : 'Không gửi được nước đi');
      void refetch();
    },
  });

  const resignMut = useMutation({
    mutationFn: () => api.post<GameMatch>(`/games/${id}/resign`),
    onSuccess: (m) => qc.setQueryData(['game', id], m),
    onError: (e: Error) => message.error(e.message),
  });

  const offerMut = useMutation({
    mutationFn: (kind: 'draw' | 'takeback') => api.post<GameMatch>(`/games/${id}/offer`, { kind }),
    onSuccess: (m) => qc.setQueryData(['game', id], m),
    onError: (e: Error) => message.error(e instanceof ApiClientError ? e.message : 'Không gửi được lời mời'),
  });

  const respondMut = useMutation({
    mutationFn: (accept: boolean) => api.post<GameMatch>(`/games/${id}/offer/respond`, { accept }),
    onSuccess: (m) => qc.setQueryData(['game', id], m),
    onError: (e: Error) => message.error(e.message),
  });

  const finished = match?.status === 'finished';

  const resultKind: ResultKind | null = (() => {
    if (!match || !finished) return null;
    if (match.result === 'draw') return 'draw';
    return match.winner_id === me?.id ? 'win' : 'lose';
  })();

  const handleCaroPlace = (r: number, c: number) => moveMut.mutate({ move: `${r},${c}` });

  const handleChessMove = (mv: AppliedMove) => {
    let result: string | undefined;
    if (mv.draw) result = 'draw';
    else if (mv.winnerColor && match) {
      const winnerSide: Side = mv.winnerColor === 'w' ? 'white' : 'black';
      result = winnerSide === match.host_side ? 'host_win' : 'guest_win';
    }
    moveMut.mutate({ move: mv.uci, resulting_fen: mv.fen, result });
  };

  return (
    <PageState isLoading={isLoading} isError={isError} onRetry={refetch}>
      {match && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card style={{ borderRadius: 20 }} styles={{ body: { padding: 14 } }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <PlayerBadge
                name={match.host?.display_name}
                gender={match.host?.gender}
                side={match.host_side}
                active={match.turn_user_id === match.host?.id}
                you={match.host?.id === me?.id}
              />
              <Text strong style={{ fontFamily: '"Baloo 2", cursive', fontSize: 18 }}>
                VS
              </Text>
              <PlayerBadge
                name={match.guest?.display_name ?? 'Đang chờ…'}
                gender={match.guest?.gender}
                side={match.guest_side}
                active={match.turn_user_id === match.guest?.id}
                you={match.guest?.id === me?.id}
              />
            </Space>
          </Card>

          <StatusBanner match={match} youWaiting={!match.is_your_turn} />

          {match.pending_offer && match.pending_by !== me?.id && (
            <OfferBanner
              text={`Đối thủ ${match.pending_offer === 'draw' ? 'xin cầu hòa 🤝' : 'xin đi lại nước vừa rồi ↩️'}`}
              onAccept={() => respondMut.mutate(true)}
              onDecline={() => respondMut.mutate(false)}
              loading={respondMut.isPending}
            />
          )}
          {match.pending_offer && match.pending_by === me?.id && (
            <OfferBanner
              text={`Đang chờ đối thủ trả lời lời ${match.pending_offer === 'draw' ? 'cầu hòa' : 'xin đi lại'}…`}
              onCancel={() => respondMut.mutate(false)}
              loading={respondMut.isPending}
            />
          )}

          {match.game_type === 'caro' ? (
            <CaroBoard
              board={(match.state as CaroState).board}
              onPlace={handleCaroPlace}
              disabled={!match.is_your_turn || match.status !== 'active'}
              lastMove={lastCaroMove(match.state as CaroState)}
              winLine={match.win_line}
            />
          ) : (
            <ChessBoard
              fen={(match.state as ChessState).fen}
              onMove={handleChessMove}
              orientation={match.your_side === 'black' ? 'black' : 'white'}
              disabled={!match.is_your_turn || match.status !== 'active'}
              lastMoveUci={(match.state as ChessState).last_move}
            />
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {match.status === 'active' && (match.host?.id === me?.id || match.guest?.id === me?.id) && (
              <>
                <Button
                  disabled={!!match.pending_offer}
                  loading={offerMut.isPending && offerMut.variables === 'draw'}
                  onClick={() => offerMut.mutate('draw')}
                >
                  Cầu hòa 🤝
                </Button>
                {!match.is_your_turn && (
                  <Button
                    disabled={!!match.pending_offer}
                    loading={offerMut.isPending && offerMut.variables === 'takeback'}
                    onClick={() => offerMut.mutate('takeback')}
                  >
                    Xin đi lại ↩️
                  </Button>
                )}
                <Button danger disabled={!!match.pending_offer} loading={resignMut.isPending} onClick={() => resignMut.mutate()}>
                  Đầu hàng 🏳️
                </Button>
              </>
            )}
            <Button onClick={() => navigate(base)}>Về sảnh</Button>
          </div>
        </Space>
      )}

      {resultKind && (
        <GameResultOverlay
          kind={resultKind}
          onLobby={() => navigate(base)}
          subtitle={match?.game_type === 'caro' ? 'Cờ Caro' : 'Cờ Vua'}
        />
      )}
    </PageState>
  );
}

function lastCaroMove(state: CaroState) {
  const m = state.moves?.[state.moves.length - 1];
  return m ? { r: m.r, c: m.c } : null;
}

function OfferBanner({
  text,
  onAccept,
  onDecline,
  onCancel,
  loading,
}: {
  text: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  loading?: boolean;
}) {
  return (
    <div
      className="bn-pop"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        justifyContent: 'center',
        background: 'linear-gradient(135deg,#fff7e0,#ffe9f2)',
        border: '2px solid #ffd76a',
        borderRadius: 16,
        padding: '10px 14px',
      }}
    >
      <Text strong style={{ fontSize: 14 }}>
        {text}
      </Text>
      <Space>
        {onAccept && (
          <Button type="primary" size="small" loading={loading} onClick={onAccept}>
            Đồng ý
          </Button>
        )}
        {onDecline && (
          <Button size="small" disabled={loading} onClick={onDecline}>
            Từ chối
          </Button>
        )}
        {onCancel && (
          <Button size="small" loading={loading} onClick={onCancel}>
            Hủy lời mời
          </Button>
        )}
      </Space>
    </div>
  );
}

function PlayerBadge({
  name,
  gender,
  side,
  active,
  you,
}: {
  name?: string | null;
  gender?: 'male' | 'female' | null;
  side?: Side | null;
  active?: boolean;
  you?: boolean;
}) {
  return (
    <div
      className={active ? 'bn-pulse' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 999,
        background: active ? 'rgba(124,92,252,0.12)' : 'transparent',
      }}
    >
      <ChildAvatar name={name ?? undefined} gender={gender ?? undefined} size={38} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Text strong style={{ fontSize: 14 }}>
          {name} {you && '(bạn)'}
        </Text>
        {side && <Text type="secondary" style={{ fontSize: 12 }}>{sideLabel(side)}</Text>}
      </div>
    </div>
  );
}

function sideLabel(side: Side): string {
  return { x: 'Quân X', o: 'Quân O', white: 'Quân trắng', black: 'Quân đen' }[side];
}

function StatusBanner({ match, youWaiting }: { match: GameMatch; youWaiting: boolean }) {
  let text = '';
  let color = '#7C5CFC';
  if (match.status === 'waiting') {
    text = 'Đang chờ đối thủ tham gia… Chia sẻ để rủ người chơi nhé!';
    color = '#FFC531';
  } else if (match.status === 'finished') {
    text = match.result === 'draw' ? 'Ván đấu hòa 🤝' : 'Ván đã kết thúc';
    color = '#3DD598';
  } else {
    text = match.is_your_turn ? 'Đến lượt bạn! ✨' : 'Chờ đối thủ đi…';
    color = match.is_your_turn ? '#3DD598' : '#8c85a3';
  }
  return (
    <div style={{ textAlign: 'center' }}>
      <Tag color={match.status === 'active' && match.is_your_turn ? 'green' : 'default'} style={{ fontSize: 14, padding: '4px 14px', borderRadius: 999, color }}>
        {text}
      </Tag>
      {youWaiting && match.status === 'active' && (
        <div style={{ fontSize: 11, color: '#b7b0c9', marginTop: 4 }}>Tự động cập nhật…</div>
      )}
    </div>
  );
}
