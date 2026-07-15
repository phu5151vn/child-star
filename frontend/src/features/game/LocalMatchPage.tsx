import { Button, Card, Space, Switch, Tag, Typography } from 'antd';
import { useState } from 'react';
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
  const base = `/${me?.role ?? 'child'}/games`;
  const isChess = type === 'chess';
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <Title level={3} style={{ fontFamily: '"Baloo 2", cursive', margin: 0 }}>
          {isChess ? '♟️ Cờ Vua' : '⭕ Cờ Caro'} — chung 1 máy
        </Title>
        <Text type="secondary">Hai người thay phiên nhau trên cùng thiết bị</Text>
      </div>
      {isChess ? <LocalChess onExit={() => navigate(base)} /> : <LocalCaro onExit={() => navigate(base)} />}
      <div style={{ textAlign: 'center' }}>
        <Button onClick={() => navigate(base)}>Về sảnh</Button>
      </div>
    </Space>
  );
}

function LocalCaro({ onExit }: { onExit: () => void }) {
  const [params] = useSearchParams();
  const block = params.get('block') === '1';
  const [board, setBoard] = useState<(Side | null)[][]>(() => emptyCaroBoard(CARO_SIZE));
  const [side, setSide] = useState<'x' | 'o'>('x');
  const [winLine, setWinLine] = useState<CaroWinLine | null>(null);
  const [last, setLast] = useState<{ r: number; c: number } | null>(null);
  const [result, setResult] = useState<'x' | 'o' | 'draw' | null>(null);

  const place = (r: number, c: number) => {
    if (result || board[r][c]) return;
    const next = board.map((row) => [...row]);
    next[r][c] = side;
    setBoard(next);
    setLast({ r, c });
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

  const reset = () => {
    setBoard(emptyCaroBoard(CARO_SIZE));
    setSide('x');
    setWinLine(null);
    setLast(null);
    setResult(null);
  };

  return (
    <>
      <Card style={{ borderRadius: 16, textAlign: 'center' }} styles={{ body: { padding: 10 } }}>
        {result ? (
          <Text strong>Kết thúc</Text>
        ) : (
          <Space>
            <Text>Lượt của</Text>
            <CaroMark symbol={side} size={22} animate={false} />
            <Text strong>{side === 'x' ? 'Quân X' : 'Quân O'}</Text>
          </Space>
        )}
        {block && (
          <div>
            <Tag color="purple">Luật: Chặn 2 đầu</Tag>
          </div>
        )}
      </Card>
      <CaroBoard board={board} onPlace={place} disabled={!!result} lastMove={last} winLine={winLine} />
      {result && (
        <GameResultOverlay
          kind={result === 'draw' ? 'draw' : 'win'}
          subtitle={result === 'draw' ? 'Cờ Caro' : `${result === 'x' ? 'Quân X' : 'Quân O'} chiến thắng!`}
          onPlayAgain={reset}
          onLobby={onExit}
        />
      )}
    </>
  );
}

function LocalChess({ onExit }: { onExit: () => void }) {
  const [fen, setFen] = useState(CHESS_START);
  const [lastUci, setLastUci] = useState<string | null>(null);
  const [rotate, setRotate] = useState(true);
  const [over, setOver] = useState<{ kind: ResultKind; subtitle: string } | null>(null);
  const { turn } = useChessGame(fen);

  const handleMove = (mv: AppliedMove) => {
    setFen(mv.fen);
    setLastUci(mv.uci);
    if (mv.over) {
      if (mv.draw) setOver({ kind: 'draw', subtitle: 'Cờ Vua' });
      else
        setOver({
          kind: 'win',
          subtitle: `Quân ${mv.winnerColor === 'w' ? 'trắng' : 'đen'} chiến thắng!`,
        });
    }
  };

  const reset = () => {
    setFen(CHESS_START);
    setLastUci(null);
    setOver(null);
  };

  const orientation = rotate ? (turn === 'w' ? 'white' : 'black') : 'white';

  return (
    <>
      <Card style={{ borderRadius: 16, textAlign: 'center' }} styles={{ body: { padding: 10 } }}>
        <Space direction="vertical" size={4}>
          <Text strong>{over ? 'Kết thúc' : `Lượt: Quân ${turn === 'w' ? 'trắng' : 'đen'}`}</Text>
          <Space>
            <Switch checked={rotate} onChange={setRotate} size="small" />
            <Text style={{ fontSize: 13 }}>Xoay bàn theo lượt</Text>
          </Space>
        </Space>
      </Card>
      <ChessBoard fen={fen} onMove={handleMove} orientation={orientation} lastMoveUci={lastUci} disabled={!!over} />
      {over && (
        <GameResultOverlay kind={over.kind} subtitle={over.subtitle} onPlayAgain={reset} onLobby={onExit} />
      )}
    </>
  );
}
