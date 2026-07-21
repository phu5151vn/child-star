import { useMemo, useState, type CSSProperties } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Square } from 'chess.js';
import { useChessGame, type AppliedMove } from '../hooks/useChessGame';
import { ChessPiece } from './PieceIcon';

interface ChessBoardProps {
  fen: string;
  onMove?: (move: AppliedMove) => void;
  orientation?: 'white' | 'black';
  disabled?: boolean;
  lastMoveUci?: string | null;
  maxWidth?: number;
}

const LIGHT = '#f3ecff';
const DARK = '#c9b6f7';

// Bộ quân đầy đủ của MỘT bên (trừ vua): 1 hậu, 2 xe, 2 tượng, 2 mã, 8 tốt = 15 quân.
const FULL_SET = ['q', 'r', 'r', 'b', 'b', 'n', 'n', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'];

/** Toạ độ hiển thị (cột, hàng) của một ô theo hướng bàn — dùng để tính quãng trượt quân. */
function displayPos(sq: Square, orientation: 'white' | 'black') {
  const file = sq.charCodeAt(0) - 97; // a=0 … h=7
  const rank = Number(sq[1]); // 1 … 8
  return orientation === 'white'
    ? { col: file, row: 8 - rank }
    : { col: 7 - file, row: rank - 1 };
}

function capturedFor(board: { type: string | null; color: 'w' | 'b' | null }[][], color: 'w' | 'b') {
  const counts: Record<string, number> = {};
  board.flat().forEach((c) => {
    if (c.color === color && c.type && c.type !== 'k') counts[c.type] = (counts[c.type] ?? 0) + 1;
  });
  const remaining = { ...counts };
  const captured: string[] = [];
  for (const p of FULL_SET) {
    if (remaining[p] > 0) remaining[p] -= 1;
    else captured.push(p);
  }
  return captured;
}

export function ChessBoard({
  fen,
  onMove,
  orientation = 'white',
  disabled,
  lastMoveUci,
  maxWidth = 480,
}: ChessBoardProps) {
  const { t } = useTranslation();
  const { board, turn, legalTargets, needsPromotion, applyMove, game } = useChessGame(fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);

  const targets = useMemo(() => (selected ? new Set(legalTargets(selected)) : new Set<Square>()), [selected, legalTargets]);

  const lastFrom = lastMoveUci ? (lastMoveUci.slice(0, 2) as Square) : null;
  const lastTo = lastMoveUci ? (lastMoveUci.slice(2, 4) as Square) : null;

  // Quãng trượt (theo số ô) của quân vừa đi: từ ô nguồn -> ô đích, có tính hướng bàn.
  const slide = useMemo(() => {
    if (!lastFrom || !lastTo) return null;
    const from = displayPos(lastFrom, orientation);
    const to = displayPos(lastTo, orientation);
    return { dx: from.col - to.col, dy: from.row - to.row };
  }, [lastFrom, lastTo, orientation]);

  const kingInCheck: Square | null = useMemo(() => {
    if (!game.isCheck()) return null;
    for (const row of board) for (const cell of row) if (cell.type === 'k' && cell.color === turn) return cell.square;
    return null;
  }, [board, turn, game]);

  const rows = orientation === 'white' ? board : [...board].reverse().map((r) => [...r].reverse());

  const commit = (from: Square, to: Square, promotion?: string) => {
    const result = applyMove(from, to, promotion);
    setSelected(null);
    setPromo(null);
    if (result) onMove?.(result);
  };

  const handleCell = (sq: Square, hasPieceOfTurn: boolean) => {
    if (disabled || !onMove) return;
    if (selected && targets.has(sq)) {
      if (needsPromotion(selected, sq)) setPromo({ from: selected, to: sq });
      else commit(selected, sq);
      return;
    }
    if (hasPieceOfTurn) setSelected(sq === selected ? null : sq);
    else setSelected(null);
  };

  const cell = Math.min(maxWidth, 480) / 8;

  return (
    <div style={{ width: `min(100%, ${maxWidth}px)`, margin: '0 auto' }}>
      <CapturedTray board={board} color="b" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
          aspectRatio: '1 / 1',
          borderRadius: 14,
          overflow: 'hidden',
          border: '3px solid #b79bf0',
          boxShadow: '0 12px 30px -14px rgba(124,92,252,0.55)',
          touchAction: 'manipulation',
        }}
      >
        {rows.map((row) =>
          row.map((c) => {
            const sq = c.square;
            const fileIdx = sq.charCodeAt(0) - 97;
            const rankIdx = Number(sq[1]) - 1;
            const isDark = (fileIdx + rankIdx) % 2 === 0;
            const isSel = selected === sq;
            const isTarget = targets.has(sq);
            const isLast = sq === lastFrom || sq === lastTo;
            const isCheck = sq === kingInCheck;
            const pieceOfTurn = c.color === turn;
            return (
              <button
                key={sq}
                type="button"
                onClick={() => handleCell(sq, pieceOfTurn)}
                aria-label={sq}
                style={{
                  position: 'relative',
                  border: 'none',
                  padding: 0,
                  background: isCheck
                    ? '#ffb3b3'
                    : isSel
                      ? '#ffe08a'
                      : isLast
                        ? isDark
                          ? '#b7a0e8'
                          : '#e3d4ff'
                        : isDark
                          ? DARK
                          : LIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: !disabled && onMove ? 'pointer' : 'default',
                }}
              >
                {c.type && (
                  <span
                    key={isLast && sq === lastTo && slide ? `slide-${lastMoveUci}` : 'piece'}
                    className={`bn-chess-piece${isLast && sq === lastTo && slide ? ' bn-chess-slide' : ''}`}
                    style={
                      isLast && sq === lastTo && slide
                        ? ({ ['--dx']: slide.dx, ['--dy']: slide.dy } as CSSProperties)
                        : undefined
                    }
                  >
                    <ChessPiece type={c.type} color={c.color as 'w' | 'b'} size={Math.round(cell * 0.82)} />
                  </span>
                )}
                {isTarget && (
                  <span
                    key="ind"
                    style={{
                      position: 'absolute',
                      width: c.type ? '92%' : '30%',
                      aspectRatio: '1 / 1',
                      borderRadius: '50%',
                      background: c.type ? 'transparent' : 'rgba(61,213,152,0.7)',
                      boxShadow: c.type ? 'inset 0 0 0 4px rgba(61,213,152,0.85)' : 'none',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </button>
            );
          }),
        )}
      </div>
      <CapturedTray board={board} color="w" />

      <Modal
        open={!!promo}
        onCancel={() => setPromo(null)}
        footer={null}
        title={t('game:chess.promotion')}
        centered
        width={280}
      >
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
          {(['q', 'r', 'b', 'n'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => promo && commit(promo.from, promo.to, p)}
              style={{
                border: '2px solid #e7d8ff',
                borderRadius: 12,
                background: '#faf7ff',
                padding: 8,
                cursor: 'pointer',
              }}
            >
              <ChessPiece type={p} color={turn} size={38} />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function CapturedTray({
  board,
  color,
}: {
  board: { type: string | null; color: 'w' | 'b' | null }[][];
  color: 'w' | 'b';
}) {
  const captured = capturedFor(board, color);
  return (
    <div style={{ minHeight: 26, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', padding: '4px 2px' }}>
      {captured.map((p, i) => (
        <ChessPiece key={`${p}-${i}`} type={p} color={color} size={18} />
      ))}
    </div>
  );
}
