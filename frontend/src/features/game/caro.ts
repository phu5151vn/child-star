import type { CaroWinLine, Side } from '@/api/client';

export const CARO_SIZE = 15;

export function emptyCaroBoard(size = CARO_SIZE): (Side | null)[][] {
  return Array.from({ length: size }, () => Array<Side | null>(size).fill(null));
}

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/**
 * Dò 5-liên-tiếp qua ô (r,c) — mirror của backend `_caro_check_win` để pass-and-play
 * chạy hoàn toàn phía client với cùng luật.
 */
export function checkCaroWin(
  board: (Side | null)[][],
  r: number,
  c: number,
  side: Side,
  blockTwoEnds: boolean,
): CaroWinLine | null {
  const size = board.length;
  const blocked = (rr: number, cc: number): boolean => {
    if (rr < 0 || rr >= size || cc < 0 || cc >= size) return true;
    return board[rr][cc] !== null && board[rr][cc] !== side;
  };

  for (const [dr, dc] of DIRS) {
    const cells: [number, number][] = [[r, c]];
    let rr = r + dr;
    let cc = c + dc;
    while (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr][cc] === side) {
      cells.push([rr, cc]);
      rr += dr;
      cc += dc;
    }
    const fwdEnd: [number, number] = [rr, cc];
    rr = r - dr;
    cc = c - dc;
    while (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr][cc] === side) {
      cells.unshift([rr, cc]);
      rr -= dr;
      cc -= dc;
    }
    const bwdEnd: [number, number] = [rr, cc];

    const count = cells.length;
    if (count < 5) continue;
    const winLine: CaroWinLine = { cells, dir: [dr, dc] };
    if (!blockTwoEnds || count > 5) return winLine;
    if (blocked(fwdEnd[0], fwdEnd[1]) && blocked(bwdEnd[0], bwdEnd[1])) continue;
    return winLine;
  }
  return null;
}

export function isBoardFull(board: (Side | null)[][]): boolean {
  return board.every((row) => row.every((c) => c !== null));
}
