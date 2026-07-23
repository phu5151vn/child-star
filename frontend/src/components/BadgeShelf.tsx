import type { BadgeInfo } from '@/api/client';
import { BadgeCard } from './BadgeCard';

interface BadgeShelfProps {
  badges: BadgeInfo[];
}

/** Kệ huy hiệu dạng lưới, tự co theo bề rộng. */
export function BadgeShelf({ badges }: BadgeShelfProps) {
  return (
    <div
      className="bn-stagger"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
      }}
    >
      {badges.map((badge) => (
        <BadgeCard key={badge.code} badge={badge} />
      ))}
    </div>
  );
}
