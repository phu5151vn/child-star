import { useEffect } from 'react';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { celebrateUnlock } from '@/components/CelebrationFx';

export type ResultKind = 'win' | 'lose' | 'draw';

interface GameResultOverlayProps {
  kind: ResultKind;
  onPlayAgain?: () => void;
  onLobby: () => void;
  subtitle?: string;
}

const CONTENT: Record<ResultKind, { emoji: string; titleKey: string; color: string }> = {
  win: { emoji: '🏆', titleKey: 'game:result.win', color: '#3DD598' },
  lose: { emoji: '💪', titleKey: 'game:result.lose', color: '#FF5C5C' },
  draw: { emoji: '🤝', titleKey: 'game:result.draw', color: '#FFC531' },
};

export function GameResultOverlay({ kind, onPlayAgain, onLobby, subtitle }: GameResultOverlayProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (kind === 'win') celebrateUnlock();
  }, [kind]);

  const c = CONTENT[kind];
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(43,36,64,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        className="bn-pop"
        style={{
          background: '#fff',
          borderRadius: 28,
          padding: '32px 28px',
          textAlign: 'center',
          maxWidth: 340,
          width: '100%',
          boxShadow: '0 24px 60px -20px rgba(124,92,252,0.6)',
        }}
      >
        <div className="bn-float" style={{ fontSize: 64, lineHeight: 1 }}>
          {c.emoji}
        </div>
        <h2 style={{ margin: '12px 0 4px', fontFamily: '"Baloo 2", cursive', color: c.color }}>{t(c.titleKey)}</h2>
        {subtitle && <p style={{ margin: '0 0 8px', color: '#8c85a3' }}>{subtitle}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          {onPlayAgain && (
            <Button type="primary" size="large" block onClick={onPlayAgain}>
              {t('game:result.playAgain')}
            </Button>
          )}
          <Button size="large" block onClick={onLobby}>
            {t('game:result.toLobby')}
          </Button>
        </div>
      </div>
    </div>
  );
}
