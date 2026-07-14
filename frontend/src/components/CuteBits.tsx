import { Avatar } from 'antd';
import { childAvatarUrl, genderEmoji, type Gender } from '@/theme/cute';

interface EmojiIconProps {
  emoji: string;
  size?: number;
  className?: string;
}

/** Icon emoji trong nền tròn gradient dễ thương. */
export function EmojiIcon({ emoji, size = 48, className }: EmojiIconProps) {
  return (
    <span
      className={`bn-emoji-badge${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }}
      role="img"
      aria-label="icon"
    >
      {emoji}
    </span>
  );
}

interface ChildAvatarProps {
  name?: string;
  gender?: Gender;
  size?: number;
  float?: boolean;
}

/** Avatar con sinh tự động theo giới tính, fallback emoji nếu ảnh lỗi. */
export function ChildAvatar({ name, gender, size = 44, float }: ChildAvatarProps) {
  return (
    <Avatar
      size={size}
      src={childAvatarUrl(name, gender)}
      className={float ? 'bn-float' : undefined}
      style={{
        border: '2px solid #fff',
        boxShadow: '0 4px 12px -4px rgba(124,92,252,0.5)',
        background: gender === 'female' ? '#ffd5e5' : gender === 'male' ? '#b6e3f4' : '#e5dbff',
      }}
    >
      {genderEmoji(gender)}
    </Avatar>
  );
}
