import type { ThemeConfig } from 'antd';

export const stitchTokens = {
  colorPrimary: '#7C5CFC',
  colorSuccess: '#3DD598',
  colorError: '#FF5C5C',
  colorWarning: '#FFC531',
  colorBgLayout: '#FBF7FF',
  colorBgContainer: '#FFFFFF',
  borderRadius: 16,
  borderRadiusLG: 24,
  fontFamily: '"Nunito", sans-serif',
  fontFamilyHeading: '"Baloo 2", cursive',
};

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: stitchTokens.colorPrimary,
    colorSuccess: stitchTokens.colorSuccess,
    colorError: stitchTokens.colorError,
    colorWarning: stitchTokens.colorWarning,
    colorBgLayout: stitchTokens.colorBgLayout,
    colorBgContainer: stitchTokens.colorBgContainer,
    borderRadius: stitchTokens.borderRadius,
    borderRadiusLG: stitchTokens.borderRadiusLG,
    fontFamily: stitchTokens.fontFamily,
  },
  components: {
    Card: { borderRadiusLG: stitchTokens.borderRadiusLG },
    Button: { borderRadius: stitchTokens.borderRadius },
    Layout: { bodyBg: stitchTokens.colorBgLayout },
  },
};

export const lockedColor = '#C7C2E0';
export const pointsAccent = '#FFC531';
