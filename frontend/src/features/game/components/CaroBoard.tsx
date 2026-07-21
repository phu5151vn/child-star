import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CaroWinLine, Side } from '@/api/client';
import { CaroMark } from './PieceIcon';

interface CaroBoardProps {
  board: (Side | null)[][];
  onPlace?: (r: number, c: number) => void;
  disabled?: boolean;
  lastMove?: { r: number; c: number } | null;
  winLine?: CaroWinLine | null;
  maxWidth?: number;
}

export function CaroBoard({ board, onPlace, disabled, lastMove, winLine, maxWidth = 560 }: CaroBoardProps) {
  const { t } = useTranslation();
  const size = board.length;
  const winSet = useMemo(() => {
    const s = new Set<string>();
    winLine?.cells.forEach(([r, c]) => s.add(`${r},${c}`));
    return s;
  }, [winLine]);

  return (
    <div
      style={{
        width: `min(100%, ${maxWidth}px)`,
        aspectRatio: '1 / 1',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`,
        background: 'linear-gradient(135deg,#fef6e4,#fde9f0)',
        border: '3px solid #e7d8ff',
        borderRadius: 16,
        padding: 4,
        gap: 1,
        boxShadow: '0 10px 30px -14px rgba(124,92,252,0.5)',
        touchAction: 'manipulation',
      }}
    >
      {board.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r},${c}`;
          const isLast = lastMove?.r === r && lastMove?.c === c;
          const isWin = winSet.has(key);
          const empty = cell === null;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled || !empty || !onPlace}
              onClick={() => empty && onPlace?.(r, c)}
              aria-label={
                cell
                  ? t('game:caro.cellAriaMark', { row: r + 1, col: c + 1, mark: cell.toUpperCase() })
                  : t('game:caro.cellAria', { row: r + 1, col: c + 1 })
              }
              style={{
                border: 'none',
                borderRadius: 6,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: !disabled && empty && onPlace ? 'pointer' : 'default',
                background: isWin
                  ? 'rgba(61,213,152,0.4)'
                  : isLast
                    ? 'rgba(124,92,252,0.16)'
                    : 'rgba(255,255,255,0.72)',
                boxShadow: isWin ? 'inset 0 0 0 2px #3DD598' : 'inset 0 0 0 1px rgba(124,92,252,0.08)',
                transition: 'background 0.15s ease',
              }}
              className={isWin ? 'bn-pulse' : undefined}
            >
              {cell && (
                <span className={isLast ? 'bn-place' : undefined} style={{ display: 'flex' }}>
                  <CaroMark symbol={cell as 'x' | 'o'} size={22} animate={isLast} />
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
