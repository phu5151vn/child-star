import confetti from 'canvas-confetti';
import type { ProgressionEvents } from '@/api/client';

const CELEBRATION_KEY = 'benngoan_celebration';

export function isCelebrationEnabled(): boolean {
  return localStorage.getItem(CELEBRATION_KEY) !== 'off';
}

export function setCelebrationEnabled(enabled: boolean) {
  localStorage.setItem(CELEBRATION_KEY, enabled ? 'on' : 'off');
}

export function celebratePoints() {
  if (!isCelebrationEnabled()) return;
  void confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#7C5CFC', '#FFC531', '#3DD598'],
  });
}

export function celebrateUnlock() {
  if (!isCelebrationEnabled()) return;
  void confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.5 },
    colors: ['#FFC531', '#7C5CFC', '#FF5C5C'],
  });
}

export interface ProgressionCelebration {
  leveledUp: boolean;
  milestone: number | null;
  badges: NonNullable<ProgressionEvents['newly_earned_badges']>;
  has: boolean;
}

/**
 * Ăn mừng theo progression_events trả về từ approve (level-up / mốc streak / huy hiệu mới).
 * Tôn trọng cấu hình tắt hiệu ứng; trả về tóm tắt để hiển thị thông báo.
 */
export function celebrateProgression(events?: ProgressionEvents | null): ProgressionCelebration {
  const leveledUp = !!events?.level_up;
  const milestone = events?.streak_milestone_reached ?? null;
  const badges = events?.newly_earned_badges ?? [];
  const has = leveledUp || milestone != null || badges.length > 0;

  if (has && isCelebrationEnabled()) {
    celebrateUnlock();
    if (leveledUp) {
      // Lên cấp: bắn thêm một lượt cho tưng bừng.
      setTimeout(() => celebrateUnlock(), 260);
    }
  }
  return { leveledUp, milestone, badges, has };
}
