import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Vị trí chấm (pip) cho từng mặt 1..6 trên lưới 3x3.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Góc xoay khối để mặt có giá trị v hướng ra trước (khớp vị trí 6 mặt bên dưới).
const FACE_ANGLE: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0],
};

function faceTransform(value: number, extraTurns: number): string {
  const [bx, by] = FACE_ANGLE[value] ?? [0, 0];
  return `rotateX(${bx + extraTurns * 360}deg) rotateY(${by + extraTurns * 360}deg)`;
}

function Face({ value, className }: { value: number; className: string }) {
  return (
    <div className={`ludo-die-face ${className}`}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="ludo-pip-slot">
          {PIPS[value].includes(i) && <span className="ludo-pip" />}
        </span>
      ))}
    </div>
  );
}

interface LudoDiceProps {
  value: number | null;
  /** Tăng mỗi lần gieo mới -> kích hoạt xoay (kể cả khi ra lại cùng số). */
  spinKey: number;
  disabled?: boolean;
  onRoll?: () => void;
}

export function LudoDice({ value, spinKey, disabled, onRoll }: LudoDiceProps) {
  const { t } = useTranslation();
  const turns = useRef(0);
  const [transform, setTransform] = useState(() => faceTransform(value ?? 1, 0));
  const [spinning, setSpinning] = useState(false);

  // Mỗi lần gieo mới: cộng thêm vài vòng rồi đáp đúng mặt kết quả.
  useEffect(() => {
    if (spinKey === 0 || value == null) return;
    turns.current += 3;
    setTransform(faceTransform(value, turns.current));
    setSpinning(true);
    const t = setTimeout(() => setSpinning(false), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  return (
    <div className="ludo-dice-wrap">
      <div className="ludo-dice-scene">
        <div
          className={`ludo-die${spinning ? ' is-spinning' : ''}`}
          style={{ transform }}
          onClick={!disabled ? onRoll : undefined}
          role="button"
          aria-label={t('components:ludoDice.rollAria')}
        >
          <Face value={1} className="f-front" />
          <Face value={6} className="f-back" />
          <Face value={3} className="f-right" />
          <Face value={4} className="f-left" />
          <Face value={2} className="f-top" />
          <Face value={5} className="f-bottom" />
        </div>
      </div>
      <div className="ludo-dice-shadow" />
      {onRoll && (
        <button className="ludo-roll-btn" onClick={onRoll} disabled={disabled || spinning}>
          {spinning ? t('components:ludoDice.rolling') : t('components:ludoDice.roll')}
        </button>
      )}
    </div>
  );
}
