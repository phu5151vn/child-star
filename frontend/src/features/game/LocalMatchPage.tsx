import { Button, Card, Space, Switch, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { CaroWinLine, Side } from '@/api/client';
import { useAuth } from '@/features/auth/AuthContext';
import { CaroBoard } from './components/CaroBoard';
import { ChessBoard } from './components/ChessBoard';
import { CaroMark } from './components/PieceIcon';
import { GameResultOverlay, type ResultKind } from './components/GameResultOverlay';
import { CARO_SIZE, checkCaroWin, emptyCaroBoard, isBoardFull } from './caro';
import { useChessGame, type AppliedMove } from './hooks/useChessGame';

const { Title, Text } = Typography;
const CHESS_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function LocalMatchPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { me } = useAuth();
  const { t } = useTranslation();
  const base = `/${me?.role ?? 'child'}/games`;
  const isChess = type === 'chess';
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <Title level={3} style={{ fontFamily: '"Baloo 2", cursive', margin: 0 }}>
          {isChess ? t('game:chess.localTitle') : t('game:caro.localTitle')}
        </Title>
        <Text type="secondary">{t('game:local.subtitle')}</Text>
      </div>
      {isChess ? <LocalChess onExit={() => navigate(base)} /> : <LocalCaro onExit={() => navigate(base)} />}
      <div style={{ textAlign: 'center' }}>
        <Button onClick={() => navigate(base)}>{t('game:common.backToLobby')}</Button>
      </div>
    </Space>
  );
}

function LocalCaro({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const block = params.get('block') === '1';
  const [board, setBoard] = useState<(Side | null)[][]>(() => emptyCaroBoard(CARO_SIZE));
  const [side, setSide] = useState<'x' | 'o'>('x');
  const [winLine, setWinLine] = useState<CaroWinLine | null>(null);
  const [last, setLast] = useState<{ r: number; c: number } | null>(null);
  const [result, setResult] = useState<'x' | 'o' | 'draw' | null>(null);
  const [history, setHistory] = useState<{ r: number; c: number; side: 'x' | 'o' }[]>([]);

  const place = (r: number, c: number) => {
    if (result || board[r][c]) return;
    const next = board.map((row) => [...row]);
    next[r][c] = side;
    setBoard(next);
    setLast({ r, c });
    setHistory((h) => [...h, { r, c, side }]);
    const win = checkCaroWin(next, r, c, side, block);
    if (win) {
      setWinLine(win);
      setResult(side);
    } else if (isBoardFull(next)) {
      setResult('draw');
    } else {
      setSide(side === 'x' ? 'o' : 'x');
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const h = [...history];
    const removed = h.pop()!;
    const next = board.map((row) => [...row]);
    next[removed.r][removed.c] = null;
    setBoard(next);
    setHistory(h);
    setWinLine(null);
    setResult(null);
    setSide(removed.side); // trả lượt cho người vừa đi
    const prev = h[h.length - 1];
    setLast(prev ? { r: prev.r, c: prev.c } : null);
  };

  const reset = () => {
    setBoard(emptyCaroBoard(CARO_SIZE));
    setSide('x');
    setWinLine(null);
    setLast(null);
    setResult(null);
    setHistory([]);
  };

  return (
    <>
      <Card style={{ borderRadius: 16, textAlign: 'center' }} styles={{ body: { padding: 10 } }}>
        {result ? (
          <Text strong>{t('game:match.finished')}</Text>
        ) : (
          <Space>
            <Text>{t('game:caro.turnOf')}</Text>
            <CaroMark symbol={side} size={22} animate={false} />
            <Text strong>{t(side === 'x' ? 'game:side.x' : 'game:side.o')}</Text>
          </Space>
        )}
        {block && (
          <div>
            <Tag color="purple">{t('game:caro.blockRule')}</Tag>
          </div>
        )}
      </Card>
      <CaroBoard board={board} onPlace={place} disabled={!!result} lastMove={last} winLine={winLine} />
      <div style={{ textAlign: 'center' }}>
        <Button onClick={undo} disabled={history.length === 0}>
          {t('game:match.undo')}
        </Button>
      </div>
      {result && (
        <GameResultOverlay
          kind={result === 'draw' ? 'draw' : 'win'}
          subtitle={
            result === 'draw'
              ? t('game:caro.name')
              : t('game:match.winnerMsg', { who: t(result === 'x' ? 'game:side.x' : 'game:side.o') })
          }
          onPlayAgain={reset}
          onLobby={onExit}
        />
      )}
    </>
  );
}

function LocalChess({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation();
  const [fen, setFen] = useState(CHESS_START);
  const [lastUci, setLastUci] = useState<string | null>(null);
  const [rotate, setRotate] = useState(true);
  const [over, setOver] = useState<{ kind: ResultKind; subtitle: string } | null>(null);
  const [past, setPast] = useState<{ fen: string; lastUci: string | null }[]>([]);
  const { turn } = useChessGame(fen);

  const handleMove = (mv: AppliedMove) => {
    setPast((p) => [...p, { fen, lastUci }]); // lưu trạng thái trước nước đi để đi lại
    setFen(mv.fen);
    setLastUci(mv.uci);
    if (mv.over) {
      if (mv.draw) setOver({ kind: 'draw', subtitle: t('game:chess.name') });
      else
        setOver({
          kind: 'win',
          subtitle: t('game:match.winnerMsg', {
            who: t(mv.winnerColor === 'w' ? 'game:side.white' : 'game:side.black'),
          }),
        });
    }
  };

  const undo = () => {
    if (past.length === 0) return;
    const p = [...past];
    const prev = p.pop()!;
    setPast(p);
    setFen(prev.fen);
    setLastUci(prev.lastUci);
    setOver(null);
  };

  const reset = () => {
    setFen(CHESS_START);
    setLastUci(null);
    setOver(null);
    setPast([]);
  };

  const orientation = rotate ? (turn === 'w' ? 'white' : 'black') : 'white';

  return (
    <>
      <Card style={{ borderRadius: 16, textAlign: 'center' }} styles={{ body: { padding: 10 } }}>
        <Space direction="vertical" size={4}>
          <Text strong>
            {over
              ? t('game:match.finished')
              : t('game:chess.turn', { who: t(turn === 'w' ? 'game:side.white' : 'game:side.black') })}
          </Text>
          <Space>
            <Switch checked={rotate} onChange={setRotate} size="small" />
            <Text style={{ fontSize: 13 }}>{t('game:chess.rotateBoard')}</Text>
          </Space>
        </Space>
      </Card>
      <ChessBoard fen={fen} onMove={handleMove} orientation={orientation} lastMoveUci={lastUci} disabled={!!over} />
      <div style={{ textAlign: 'center' }}>
        <Button onClick={undo} disabled={past.length === 0}>
          {t('game:match.undo')}
        </Button>
      </div>
      {over && (
        <GameResultOverlay kind={over.kind} subtitle={over.subtitle} onPlayAgain={reset} onLobby={onExit} />
      )}
    </>
  );
}
