import confetti from 'canvas-confetti';

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
