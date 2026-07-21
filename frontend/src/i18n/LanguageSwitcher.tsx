import { GlobalOutlined } from '@ant-design/icons';
import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { changeLang, LANGS, type Lang } from '@/i18n';

interface LanguageSwitcherProps {
  /** 'default' cho nền sáng, 'onDark' cho header gradient (chữ trắng). */
  variant?: 'default' | 'onDark';
  size?: 'small' | 'middle' | 'large';
}

/** Nút chuyển đổi ngôn ngữ Việt / Anh, đồng bộ với i18next + localStorage. */
export function LanguageSwitcher({ variant = 'default', size = 'small' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const current = (LANGS as readonly string[]).includes(i18n.language) ? (i18n.language as Lang) : 'vi';

  return (
    <Segmented<Lang>
      size={size}
      value={current}
      onChange={(value) => changeLang(value)}
      aria-label="Language"
      className={variant === 'onDark' ? 'bn-lang-on-dark' : undefined}
      options={[
        { label: 'VI', value: 'vi', icon: <GlobalOutlined /> },
        { label: 'EN', value: 'en' },
      ]}
    />
  );
}
