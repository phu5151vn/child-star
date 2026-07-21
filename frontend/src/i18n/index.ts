import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonVi from './locales/vi/common';
import authVi from './locales/vi/auth';
import parentVi from './locales/vi/parent';
import childVi from './locales/vi/child';
import gameVi from './locales/vi/game';
import componentsVi from './locales/vi/components';

import commonEn from './locales/en/common';
import authEn from './locales/en/auth';
import parentEn from './locales/en/parent';
import childEn from './locales/en/child';
import gameEn from './locales/en/game';
import componentsEn from './locales/en/components';

export const LANGS = ['vi', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const STORAGE_KEY = 'lang';
export const DEFAULT_LANG: Lang = 'vi';

/** Namespace mặc định để component gọi t('key') không cần prefix. */
export const NAMESPACES = ['common', 'auth', 'parent', 'child', 'game', 'components'] as const;

export const resources = {
  vi: {
    common: commonVi,
    auth: authVi,
    parent: parentVi,
    child: childVi,
    game: gameVi,
    components: componentsVi,
  },
  en: {
    common: commonEn,
    auth: authEn,
    parent: parentEn,
    child: childEn,
    game: gameEn,
    components: componentsEn,
  },
} as const;

function readStoredLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  } catch {
    /* localStorage không khả dụng (SSR/private mode) -> dùng mặc định */
  }
  return DEFAULT_LANG;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLang(),
  fallbackLng: DEFAULT_LANG,
  // Tất cả namespace đều nạp sẵn (bundled), truy cập chéo namespace bằng 'ns:key'.
  ns: NAMESPACES as unknown as string[],
  defaultNS: 'common',
  fallbackNS: NAMESPACES as unknown as string[],
  interpolation: { escapeValue: false },
  returnNull: false,
});

function syncDocument() {
  const lang = (i18n.language as Lang) || DEFAULT_LANG;
  document.documentElement.setAttribute('lang', lang);
  document.title = i18n.t('brand.title');
}

/** Đổi ngôn ngữ + lưu lựa chọn + cập nhật <html lang> và tiêu đề trang. */
export function changeLang(lang: Lang) {
  void i18n.changeLanguage(lang).then(syncDocument);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* bỏ qua nếu không lưu được */
  }
}

// Đồng bộ ngay khi khởi tạo.
syncDocument();

export default i18n;
