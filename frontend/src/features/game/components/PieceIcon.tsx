import { Icon } from '@iconify/react';

const CHESS_ICON: Record<string, string> = {
  k: 'game-icons:chess-king',
  q: 'game-icons:chess-queen',
  r: 'game-icons:chess-rook',
  b: 'game-icons:chess-bishop',
  n: 'game-icons:chess-knight',
  p: 'game-icons:chess-pawn',
};

interface ChessPieceProps {
  /** Ký hiệu chess.js: chữ hoa = trắng, chữ thường = đen (k,q,r,b,n,p). */
  type: string;
  color: 'w' | 'b';
  size?: number;
}

/** Quân cờ vua vẽ bằng game-icons (SVG vector). Trắng viền tím, đen tô đậm. */
export function ChessPiece({ type, color, size = 40 }: ChessPieceProps) {
  const icon = CHESS_ICON[type.toLowerCase()];
  if (!icon) return null;
  const isWhite = color === 'w';
  return (
    <Icon
      icon={icon}
      width={size}
      height={size}
      style={{
        color: isWhite ? '#fff' : '#2b2440',
        filter: isWhite
          ? 'drop-shadow(0 1px 1px rgba(43,36,64,0.9)) drop-shadow(0 0 1px rgba(43,36,64,0.9))'
          : 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
        transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    />
  );
}

interface CaroMarkProps {
  symbol: 'x' | 'o';
  size?: number;
  animate?: boolean;
}

/** Dấu X / O vẽ tay có hiệu ứng "vẽ nét" khi vừa đặt. */
export function CaroMark({ symbol, size = 30, animate = true }: CaroMarkProps) {
  const stroke = symbol === 'x' ? '#7C5CFC' : '#FF5C5C';
  const dash = animate ? 'bn-draw' : undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label={symbol}>
      {symbol === 'x' ? (
        <>
          <line
            x1="9" y1="9" x2="31" y2="31" stroke={stroke} strokeWidth="6" strokeLinecap="round"
            className={dash} style={{ strokeDasharray: 34, strokeDashoffset: animate ? 34 : 0 }}
          />
          <line
            x1="31" y1="9" x2="9" y2="31" stroke={stroke} strokeWidth="6" strokeLinecap="round"
            className={dash} style={{ strokeDasharray: 34, strokeDashoffset: animate ? 34 : 0, animationDelay: '0.12s' }}
          />
        </>
      ) : (
        <circle
          cx="20" cy="20" r="12" stroke={stroke} strokeWidth="6" fill="none" strokeLinecap="round"
          className={dash} style={{ strokeDasharray: 76, strokeDashoffset: animate ? 76 : 0 }}
        />
      )}
    </svg>
  );
}
