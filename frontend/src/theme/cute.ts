/**
 * Bộ "icon dễ thương" bằng emoji + avatar theo giới tính (DiceBear).
 * Dùng chung cho task, phần thưởng, avatar con và các nhãn recurrence.
 */

import i18n from '@/i18n';

export const TASK_EMOJIS = [
  '🧹', '📚', '🍽️', '🦷', '🌱', '👕', '🛏️', '🗑️', '🐕', '🐱',
  '🎨', '🎹', '🏃', '📖', '✏️', '🧼', '🚿', '🍚', '🧦', '🎒',
  '⭐', '💪', '🧩', '🎵', '🌸', '☀️', '🧺', '🪥',
];

export const REWARD_EMOJIS = [
  '🍦', '🍭', '🎮', '📱', '🎁', '🧸', '🚲', '🎬', '🎈', '🍕',
  '🎡', '🪀', '🍫', '🎠', '🎫', '⚽', '🎨', '📚', '🏊', '🦄',
  '🍔', '🧁', '🎯', '🏆',
];

/** Emoji mặc định suy đoán từ tiêu đề nếu người dùng chưa chọn. */
export function defaultTaskEmoji(title?: string): string {
  const t = (title ?? '').toLowerCase();
  const rules: [string[], string][] = [
    [['phòng', 'dọn', 'nhà'], '🧹'],
    [['bài', 'học', 'tập'], '📚'],
    [['bát', 'chén', 'rửa'], '🍽️'],
    [['răng', 'đánh'], '🦷'],
    [['cây', 'tưới', 'hoa'], '🌱'],
    [['quần', 'áo', 'gấp', 'giặt'], '👕'],
    [['giường'], '🛏️'],
    [['rác'], '🗑️'],
    [['chó', 'mèo', 'thú'], '🐕'],
    [['đọc', 'sách'], '📖'],
    [['đàn', 'nhạc'], '🎹'],
    [['thể dục', 'chạy', 'tập'], '🏃'],
    [['vẽ'], '🎨'],
    [['tắm'], '🚿'],
  ];
  for (const [keys, emoji] of rules) {
    if (keys.some((k) => t.includes(k))) return emoji;
  }
  return '⭐';
}

export function defaultRewardEmoji(title?: string): string {
  const t = (title ?? '').toLowerCase();
  const rules: [string[], string][] = [
    [['kem', 'bánh'], '🍦'],
    [['kẹo'], '🍭'],
    [['game', 'chơi', 'điện tử'], '🎮'],
    [['điện thoại', 'ipad', 'máy tính'], '📱'],
    [['phim', 'xem'], '🎬'],
    [['đồ chơi'], '🧸'],
    [['xe', 'đạp'], '🚲'],
    [['bóng'], '⚽'],
    [['sách'], '📚'],
    [['bơi'], '🏊'],
  ];
  for (const [keys, emoji] of rules) {
    if (keys.some((k) => t.includes(k))) return emoji;
  }
  return '🎁';
}

export type Recurrence = 'once' | 'daily' | 'weekly';

// Nhãn được đọc qua getter để tự đổi theo ngôn ngữ i18n hiện hành (không cache giá trị lúc import).
export const RECURRENCE_META: Record<Recurrence, { label: string; short: string; emoji: string; color: string }> = {
  once: {
    get label() { return i18n.t('common:recurrence.once'); },
    get short() { return i18n.t('common:recurrence.onceShort'); },
    emoji: '🎯',
    color: 'default',
  },
  daily: {
    get label() { return i18n.t('common:recurrence.daily'); },
    get short() { return i18n.t('common:recurrence.dailyShort'); },
    emoji: '🔁',
    color: 'blue',
  },
  weekly: {
    get label() { return i18n.t('common:recurrence.weekly'); },
    get short() { return i18n.t('common:recurrence.weeklyShort'); },
    emoji: '📅',
    color: 'purple',
  },
};

export const RECURRENCE_OPTIONS = (Object.keys(RECURRENCE_META) as Recurrence[]).map((key) => ({
  value: key,
  get label() { return `${RECURRENCE_META[key].emoji} ${RECURRENCE_META[key].label}`; },
}));

export type Gender = 'male' | 'female' | null | undefined;

// Kiểu tóc adventurer: dài cho bé gái, ngắn cho bé trai -> phân biệt giới tính rõ ràng.
const FEMALE_HAIR = ['long02', 'long03', 'long07', 'long08', 'long12', 'long16', 'long20', 'long21'];
const MALE_HAIR = ['short01', 'short02', 'short04', 'short07', 'short08', 'short11', 'short15', 'short18'];

// Da vàng (tông sáng châu Á) cho tất cả avatar.
const SKIN = 'f2d3b1,ecad80';

/** Avatar dễ thương sinh tự động theo tên + giới tính (DiceBear, style "adventurer"). */
export function childAvatarUrl(name?: string, gender?: Gender): string {
  const seed = encodeURIComponent(name || 'be-ngoan');
  const base = `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&radius=50&backgroundType=gradientLinear&skinColor=${SKIN}`;
  if (gender === 'female') {
    return `${base}&backgroundColor=ffd5e5,ffc9de&hair=${FEMALE_HAIR.join(',')}&hairProbability=100&earringsProbability=45&glassesProbability=10`;
  }
  if (gender === 'male') {
    return `${base}&backgroundColor=b6e3f4,c0e6ff&hair=${MALE_HAIR.join(',')}&hairProbability=100&earringsProbability=0&glassesProbability=15`;
  }
  return `${base}&backgroundColor=d6ccff,e5dbff`;
}

export function genderEmoji(gender?: Gender): string {
  if (gender === 'female') return '👧';
  if (gender === 'male') return '👦';
  return '🧒';
}

export const GENDER_OPTIONS = [
  { value: 'female', get label() { return i18n.t('common:gender.female'); } },
  { value: 'male', get label() { return i18n.t('common:gender.male'); } },
];
