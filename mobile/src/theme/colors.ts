/**
 * Special design system — soft neutral surfaces with a confident violet identity.
 * Keep semantic tokens here so every screen stays in sync in light and dark mode.
 */
export interface ThemeColors {
  primary: string; primaryDark: string; primaryLight: string;
  gradientStart: string; gradientEnd: string;
  background: string; card: string; surface: string;
  text: string; textSecondary: string; textMuted: string; textTertiary: string;
  border: string; divider: string;
  success: string; danger: string; warning: string; error: string;
  ownMessageBg: string; ownMessageText: string; otherMessageBg: string; otherMessageText: string;
  timestamp: string; placeholder: string; inputBg: string; inputBorder: string; shadow: string;
  tabActive: string; tabInactive: string; tabBg: string; skeleton: string;
  lightBlue100: string; lightBlue50: string; blue900: string; link: string; pillBg: string;
  band: string; headerBg: string; bodyAccent: string; skipBg: string; skipText: string;
  accentGreen: string; accentYellow: string; disabledBtn: string; like: string; repost: string;
  overlay: string; hover: string; onPrimary: string;
}

export interface ThemeSpacing { xs: number; sm: number; md: number; lg: number; xl: number; }
export interface ThemeBorderRadius {
  sm: number; md: number; lg: number; xl: number; button: number;
  full: number; pill: number; card: number; input: number;
}

const lightColors: ThemeColors = {
  primary: '#6558D9',
  primaryDark: '#5145C5',
  primaryLight: '#EFEDFF',
  gradientStart: '#796DEB',
  gradientEnd: '#5145C5',
  background: '#F7F8FC',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#191A2B',
  textSecondary: '#62647A',
  textMuted: '#9294A8',
  textTertiary: '#9294A8',
  border: '#E8E9F1',
  divider: '#EEF0F5',
  success: '#159B72',
  danger: '#D94B58',
  warning: '#D98A24',
  error: '#D94B58',
  ownMessageBg: '#6558D9',
  ownMessageText: '#FFFFFF',
  otherMessageBg: '#FFFFFF',
  otherMessageText: '#191A2B',
  timestamp: '#9294A8',
  placeholder: '#9294A8',
  inputBg: '#F0F1F7',
  inputBorder: '#E1E3ED',
  shadow: 'rgba(27, 30, 58, 0.08)',
  tabActive: '#6558D9',
  tabInactive: '#85879B',
  tabBg: '#FFFFFF',
  skeleton: '#E9EAF2',
  lightBlue100: '#DCD9FF',
  lightBlue50: '#EFEDFF',
  blue900: '#191A2B',
  link: '#5145C5',
  pillBg: '#F0F1F7',
  band: '#F0F1F7',
  headerBg: '#F7F8FC',
  bodyAccent: '#191A2B',
  skipBg: '#EFEDFF',
  skipText: '#5145C5',
  accentGreen: '#159B72',
  accentYellow: '#D98A24',
  disabledBtn: '#B9B5EA',
  like: '#E9577B',
  repost: '#159B72',
  overlay: 'rgba(18, 20, 38, 0.48)',
  hover: '#F1F2F8',
  onPrimary: '#FFFFFF',
};

const darkColors: ThemeColors = {
  primary: '#958BFF',
  primaryDark: '#796DEB',
  primaryLight: '#292544',
  gradientStart: '#A69EFF',
  gradientEnd: '#7165E5',
  background: '#10111B',
  card: '#191B29',
  surface: '#1D2030',
  text: '#F2F2FA',
  textSecondary: '#B0B2C5',
  textMuted: '#85889F',
  textTertiary: '#85889F',
  border: '#2B2E40',
  divider: '#25283A',
  success: '#38C99B',
  danger: '#FF737D',
  warning: '#F3B45F',
  error: '#FF737D',
  ownMessageBg: '#7165E5',
  ownMessageText: '#FFFFFF',
  otherMessageBg: '#232638',
  otherMessageText: '#F2F2FA',
  timestamp: '#85889F',
  placeholder: '#85889F',
  inputBg: '#222538',
  inputBorder: '#34374B',
  shadow: 'rgba(0, 0, 0, 0.32)',
  tabActive: '#A69EFF',
  tabInactive: '#85889F',
  tabBg: '#191B29',
  skeleton: '#25283A',
  lightBlue100: '#343052',
  lightBlue50: '#292544',
  blue900: '#F2F2FA',
  link: '#B3ADFF',
  pillBg: '#222538',
  band: '#191B29',
  headerBg: '#10111B',
  bodyAccent: '#F2F2FA',
  skipBg: '#292544',
  skipText: '#B3ADFF',
  accentGreen: '#38C99B',
  accentYellow: '#F3B45F',
  disabledBtn: '#494568',
  like: '#FF7898',
  repost: '#38C99B',
  overlay: 'rgba(0, 0, 0, 0.64)',
  hover: '#1B1D2B',
  onPrimary: '#FFFFFF',
};

export const Colors = {
  ...lightColors,
  light: lightColors,
  dark: darkColors,
} as ThemeColors & { light: ThemeColors; dark: ThemeColors };

export const Spacing: ThemeSpacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const BorderRadius: ThemeBorderRadius = {
  sm: 10, md: 14, lg: 18, xl: 24, button: 15, full: 999, pill: 50, card: 18, input: 14,
};
