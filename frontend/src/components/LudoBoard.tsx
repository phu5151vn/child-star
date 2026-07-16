import { useEffect, useMemo, useState } from 'react';
import type { LudoPlayer } from '@/api/client';
import { LudoHorse } from './LudoHorse';

/** Bảng màu dễ thương cho 4 người chơi (0..3). */
export const LUDO_COLORS = ['#FF6B6B', '#4D96FF', '#FFC93C', '#6BCB77'];
export const LUDO_COLOR_NAMES = ['Đỏ', 'Xanh dương', 'Vàng', 'Xanh lá'];
const LUDO_DARK = ['#E23D4B', '#2F6BD6', '#E0A100', '#3FA857'];
const LUDO_LIGHT = ['#FFC2C2', '#B9D4FF', '#FFE9A6', '#C2ECC7'];

type Coord = [number, number];
const GRID = 15;
const SEG_LEN = 14; // mỗi đoạn màu 14 ô (đi liền mạch qua khuỷu, không nhảy chéo)
const TRACK_LEN = 56; // vòng chung 56 ô (4 × 14)
const CUA = 55; // ô cửa (⭐) = progress 55, ngay TRƯỚC ô xuất phát; bậc thang #1..#6 = progress 56..61 (HOME[0..5])
// #6 (61) là bậc sâu nhất, không có ô tâm để đi tiếp. Thắng khi 4 quân ở #3..#6.

// Quay 90° NGƯỢC chiều kim đồng hồ quanh tâm (7,7): (r,c) -> (14-c, r).
// Bàn cờ đi ngược chiều kim đồng hồ để khớp ảnh: chuồng TL=xanh dương, TR=đỏ,
// BL=vàng, BR=xanh lá; nhánh về đích TRÊN=xanh dương, PHẢI=đỏ, DƯỚI=xanh lá, TRÁI=vàng.
function rot(coord: Coord, times: number): Coord {
  let [r, c] = coord;
  for (let i = 0; i < times; i++) [r, c] = [14 - c, r];
  return [r, c];
}

// 14 ô "đoạn" của màu 0 (đỏ, chuồng TR) đi NGƯỢC chiều kim đồng hồ; 3 màu còn lại = quay 90°.
// Đi LIỀN MẠCH qua ô khuỷu [6,8] (không nhảy chéo). Ô xuất phát [6,14] nằm SÁT ô cửa ⭐ [7,14].
const RED_SEG: Coord[] = [
  [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [6, 8],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7],
];
export const RING: Coord[] = [];
for (let k = 0; k < 4; k++) for (let i = 0; i < SEG_LEN; i++) RING.push(rot(RED_SEG[i], k));

// Ô số về đích đỏ (nhánh PHẢI): #1..#6 = [7,13]..[7,8] (#6 sát tâm); các màu khác quay tương ứng.
const RED_HOME: Coord[] = [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]];
const HOME: Coord[][] = [0, 1, 2, 3].map((k) => RED_HOME.map((c) => rot(c, k)));

// 4 ô đỗ trong chuồng mỗi màu (trong góc 6x6) — màu 0 ở góc TR.
const RED_STABLE: Coord[] = [[1.6, 12.4], [1.6, 10.4], [3.6, 12.4], [3.6, 10.4]];
const STABLE: Coord[][] = [0, 1, 2, 3].map((k) => RED_STABLE.map((c) => rot(c, k)));

const BASE_CORNERS: Coord[][] = [0, 1, 2, 3].map((k) =>
  ([[0, 14], [0, 9], [5, 14], [5, 9]] as Coord[]).map((c) => rot(c, k)),
);

// index RING của ô xuất phát & ô cửa (⭐) theo màu (thứ tự abs không đổi so với bàn cờ cũ).
const START_IDX: Record<number, number> = { 0: 0, 14: 1, 28: 2, 42: 3 };
const CUA_IDX: Record<number, number> = { 55: 0, 13: 1, 27: 2, 41: 3 };

function pct(v: number) {
  return `${(v / GRID) * 100}%`;
}

function tokenCoord(color: number, progress: number, tokenIndex: number): Coord {
  if (progress < 0) return STABLE[color][tokenIndex];
  if (progress <= CUA) return RING[(color * SEG_LEN + progress) % TRACK_LEN];
  return HOME[color][progress - CUA - 1]; // 56->#1(HOME[0]) ... 61->#6(HOME[5])
}

interface LudoBoardProps {
  players: LudoPlayer[];
  movableTokens?: number[];
  yourColor?: number | null;
  isYourTurn?: boolean;
  onPickToken?: (tokenIndex: number) => void;
}

export function LudoBoard({ players, movableTokens = [], yourColor, isYourTurn, onPickToken }: LudoBoardProps) {
  const targets = useMemo(() => {
    const m: Record<string, number> = {};
    players.forEach((p) => p.tokens.forEach((prog, ti) => (m[`${p.color}-${ti}`] = prog)));
    return m;
  }, [players]);
  const targetsKey = JSON.stringify(targets);
  const [disp, setDisp] = useState<Record<string, number>>(targets);
  const [kicking, setKicking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDisp((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(targets)) if (!(k in next)) { next[k] = targets[k]; changed = true; }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsKey]);

  useEffect(() => {
    const changed = Object.keys(targets).filter((k) => disp[k] !== undefined && disp[k] !== targets[k]);
    if (!changed.length) return;
    const forward = changed.filter((k) => !(targets[k] < 0 && disp[k] >= 0));
    const kicked = changed.filter((k) => targets[k] < 0 && disp[k] >= 0);
    if (forward.length) {
      const t = setTimeout(() => {
        setDisp((prev) => {
          const next = { ...prev };
          for (const k of forward) {
            const cur = next[k];
            const tgt = targets[k];
            if (cur === undefined || cur === tgt) continue;
            next[k] = tgt > cur && cur >= 0 ? cur + 1 : tgt;
          }
          return next;
        });
      }, 140);
      return () => clearTimeout(t);
    }
    setKicking((prev) => ({ ...prev, ...Object.fromEntries(kicked.map((k) => [k, true])) }));
    const t = setTimeout(() => {
      setDisp((prev) => ({ ...prev, ...Object.fromEntries(kicked.map((k) => [k, targets[k]])) }));
      setKicking((prev) => {
        const next = { ...prev };
        kicked.forEach((k) => delete next[k]);
        return next;
      });
    }, 520);
    return () => clearTimeout(t);
  }, [disp, targets, targetsKey]);

  const byCell = new Map<string, number>();

  return (
    <div className="ludo-board">
      {/* 4 chuồng góc */}
      {BASE_CORNERS.map((corners, color) => {
        const top = Math.min(...corners.map((c) => c[0]));
        const left = Math.min(...corners.map((c) => c[1]));
        return (
          <div
            key={`base${color}`}
            className="ludo-base"
            style={{ top: pct(top), left: pct(left), width: pct(6), height: pct(6),
              background: `${LUDO_COLORS[color]}22`, borderColor: LUDO_COLORS[color] }}
          >
            <div className="ludo-base-inner" style={{ borderColor: LUDO_COLORS[color] }} />
          </div>
        );
      })}

      {/* Ô vòng chung: ô xuất phát tô màu đậm, ô cửa gắn ⭐ */}
      {RING.map(([r, c], idx) => {
        const startColor = START_IDX[idx];
        const cuaColor = CUA_IDX[idx];
        let cls = 'ludo-cell';
        const style: React.CSSProperties = { top: pct(r), left: pct(c), background: '#fff' };
        if (startColor !== undefined) { cls += ' ludo-start'; style.background = LUDO_COLORS[startColor]; }
        else if (cuaColor !== undefined) { cls += ' ludo-cua-cell'; style.background = LUDO_LIGHT[cuaColor]; style.borderColor = LUDO_COLORS[cuaColor]; }
        return (
          <div key={`ring${idx}`} className={cls} style={style}>
            {cuaColor !== undefined && <span className="ludo-star">⭐</span>}
          </div>
        );
      })}

      {/* Ô số về đích #1..#6 (đánh số) */}
      {HOME.map((cells, color) =>
        cells.map(([r, c], i) => (
          <div key={`home${color}-${i}`} className="ludo-cell ludo-home"
            style={{ top: pct(r), left: pct(c), background: LUDO_COLORS[color], opacity: 0.55 + i * 0.07 }}>
            <span className="ludo-home-num">{i + 1}</span>
          </div>
        )),
      )}

      {/* Ô ĐÍCH ở TÂM [7,7] — 1 ô thật, dùng chung cho cả 4 màu (mỗi tam giác hướng về nhánh cùng màu) */}
      <div className="ludo-center" style={{ top: pct(7), left: pct(7), width: pct(1), height: pct(1) }}>
        {/* thứ tự: trên=xanh dương(1), phải=đỏ(0), dưới=xanh lá(3), trái=vàng(2) */}
        {[1, 0, 3, 2].map((ci, k) => (
          <div key={k} className="ludo-center-tri" style={{ background: LUDO_COLORS[ci], transform: `rotate(${k * 90}deg)` }} />
        ))}
        <span className="ludo-center-star">🏆</span>
      </div>

      {/* Quân ngựa */}
      {players.map((p) =>
        p.tokens.map((_prog, ti) => {
          const key = `${p.color}-${ti}`;
          const prog = disp[key] ?? _prog;
          const [r, c] = tokenCoord(p.color, prog, ti);
          const cellKey = `${r.toFixed(1)},${c.toFixed(1)}`;
          const stackN = byCell.get(cellKey) ?? 0;
          byCell.set(cellKey, stackN + 1);
          const off = stackN * 1.4;
          const canMove = p.is_turn && isYourTurn && p.color === yourColor && movableTokens.includes(ti);
          const isKicked = kicking[key];
          return (
            <button
              key={`tok${p.color}-${ti}`}
              className={`ludo-token${canMove ? ' ludo-token-active' : ''}${isKicked ? ' ludo-token-kicked' : ''}`}
              onClick={canMove ? () => onPickToken?.(ti) : undefined}
              disabled={!canMove}
              style={{ top: `calc(${pct(r)} + ${off}px)`, left: `calc(${pct(c)} + ${off}px)` }}
              aria-label={`Ngựa ${LUDO_COLOR_NAMES[p.color]} ${ti + 1}`}
            >
              <LudoHorse color={LUDO_COLORS[p.color]} dark={LUDO_DARK[p.color]} light={LUDO_LIGHT[p.color]} />
            </button>
          );
        }),
      )}
    </div>
  );
}
