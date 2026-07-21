import { useTranslation } from 'react-i18next';

interface EmojiPickerProps {
  value?: string | null;
  onChange?: (value: string) => void;
  options: string[];
}

/** Bộ chọn emoji dạng lưới — dùng làm con của Form.Item (nhận value/onChange). */
export function EmojiPicker({ value, onChange, options }: EmojiPickerProps) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={`bn-emoji-pick${value === emoji ? ' selected' : ''}`}
          onClick={() => onChange?.(emoji)}
          aria-label={t('components:emojiPicker.choose', { emoji })}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
