import { useMemo } from 'react';
import { Chess, type Square } from 'chess.js';

export interface AppliedMove {
  uci: string;
  fen: string;
  over: boolean;
  winnerColor: 'w' | 'b' | null;
  draw: boolean;
  check: boolean;
}

export interface ChessCell {
  square: Square;
  type: string | null; // 'p','n','b','r','q','k'
  color: 'w' | 'b' | null;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/**
 * Bọc chess.js: từ một FEN, cung cấp bàn cờ 8×8, danh sách nước hợp lệ và hàm áp
 * dụng nước đi (trả về FEN mới + kết quả). Không giữ state — nguồn sự thật là `fen`
 * (online: từ backend; local: từ React state của trang).
 */
export function useChessGame(fen: string) {
  return useMemo(() => {
    const game = new Chess(fen);

    const board: ChessCell[][] = [];
    for (let r = 8; r >= 1; r--) {
      const row: ChessCell[] = [];
      for (const f of FILES) {
        const sq = `${f}${r}` as Square;
        const piece = game.get(sq);
        row.push({ square: sq, type: piece ? piece.type : null, color: piece ? piece.color : null });
      }
      board.push(row);
    }

    const turn = game.turn(); // 'w' | 'b'

    const legalTargets = (from: Square): Square[] => {
      try {
        return game.moves({ square: from, verbose: true }).map((m) => m.to as Square);
      } catch {
        return [];
      }
    };

    const needsPromotion = (from: Square, to: Square): boolean =>
      game
        .moves({ square: from, verbose: true })
        .some((m) => m.to === to && m.promotion);

    const applyMove = (from: Square, to: Square, promotion?: string): AppliedMove | null => {
      const probe = new Chess(fen);
      try {
        const mv = probe.move({ from, to, promotion: (promotion as 'q' | 'r' | 'b' | 'n') ?? 'q' });
        if (!mv) return null;
        const checkmate = probe.isCheckmate();
        const draw =
          probe.isStalemate() || probe.isInsufficientMaterial() || probe.isThreefoldRepetition() || probe.isDraw();
        const winnerColor = checkmate ? (probe.turn() === 'w' ? 'b' : 'w') : null;
        return {
          uci: `${from}${to}${mv.promotion ?? ''}`,
          fen: probe.fen(),
          over: checkmate || draw,
          winnerColor,
          draw: draw && !checkmate,
          check: probe.isCheck(),
        };
      } catch {
        return null;
      }
    };

    return {
      game,
      board,
      turn,
      inCheck: game.isCheck(),
      legalTargets,
      needsPromotion,
      applyMove,
    };
  }, [fen]);
}
