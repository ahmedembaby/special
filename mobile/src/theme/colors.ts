/**
 * Special design system — Violet Ink: soft lavender surfaces, deep ink text and a violet gradient identity.
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
  primary: '#5B4CF0',
  primaryDark: '#4638D4',
  primaryLight: '#EEEBFF',
  gradientStart: '#5B4CF0',
  gradientEnd: '#8B5CF6',
  background: '#F5F4FB',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#14122B',
  textSecondary: '#5F5D78',
  textMuted: '#78768F',
  textTertiary: '#8F8DA6',
  border: '#E8E6F3',
  divider: '#EFEDF8',
  success: '#16A47A',
  danger: '#E05262',
  warning: '#D99A38',
  error: '#D94B58',
  ownMessageBg: '#5B4CF0',
  ownMessageText: '#FFFFFF',
  otherMessageBg: '#FFFFFF',
  otherMessageText: '#14122B',
  timestamp: '#8F8DA6',
  placeholder: '#8F8DA6',
  inputBg: '#EFEDF8',
  inputBorder: '#E2DFF1',
  shadow: 'rgba(20, 18, 43, 0.08)',
  tabActive: '#5B4CF0',
  tabInactive: '#78768F',
  tabBg: '#FFFFFF',
  skeleton: '#E9E7F5',
  lightBlue100: '#DDD8FF',
  lightBlue50: '#EEEBFF',
  blue900: '#14122B',
  link: '#4638D4',
  pillBg: '#EFEDF8',
  band: '#EFEDF8',
  headerBg: '#F5F4FB',
  bodyAccent: '#14122B',
  skipBg: '#EEEBFF',
  skipText: '#4638D4',
  accentGreen: '#159B72',
  accentYellow: '#D98A24',
  disabledBtn: '#BDB6F5',
  like: '#E9577B',
  repost: '#159B72',
  overlay: 'rgba(20, 18, 43, 0.5)',
  hover: '#F0EEFA',
  onPrimary: '#FFFFFF',
};

const darkColors: ThemeColors = {
  primary: '#7C6CFF',
  primaryDark: '#6556E6',
  primaryLight: '#2A2650',
  gradientStart: '#A78BFA',
  gradientEnd: '#7C6CFF',
  background: '#0E0D1A',
  card: '#1A1930',
  surface: '#1F1E38',
  text: '#F2F1FF',
  textSecondary: '#B4B2D0',
  textMuted: '#9A98B8',
  textTertiary: '#8A88A8',
  border: '#2A2945',
  divider: '#222140',
  success: '#43D3A4',
  danger: '#FF7A86',
  warning: '#F3B45F',
  error: '#FF737D',
  ownMessageBg: '#6D5DF5',
  ownMessageText: '#FFFFFF',
  otherMessageBg: '#222140',
  otherMessageText: '#F2F1FF',
  timestamp: '#8A88A8',
  placeholder: '#8A88A8',
  inputBg: '#201F3A',
  inputBorder: '#34335A',
  shadow: 'rgba(0, 0, 0, 0.4)',
  tabActive: '#A395FF',
  tabInactive: '#8A88A8',
  tabBg: '#14132A',
  skeleton: '#25244A',
  lightBlue100: '#363066',
  lightBlue50: '#2A2650',
  blue900: '#F2F1FF',
  link: '#B9AEFF',
  pillBg: '#222140',
  band: '#14132A',
  headerBg: '#0E0D1A',
  bodyAccent: '#F2F1FF',
  skipBg: '#2A2650',
  skipText: '#B9AEFF',
  accentGreen: '#38C99B',
  accentYellow: '#F3B45F',
  disabledBtn: '#4A4780',
  like: '#FF7898',
  repost: '#38C99B',
  overlay: 'rgba(0, 0, 0, 0.66)',
  hover: '#1A1930',
  onPrimary: '#FFFFFF',
};

export const Colors = {
  ...lightColors,
  light: lightColors,
  dark: darkColors,
} as ThemeColors & { light: ThemeColors; dark: ThemeColors };

export const Spacing: ThemeSpacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const BorderRadius: ThemeBorderRadius = {
  sm: 8, md: 12, lg: 16, xl: 22, button: 14, full: 999, pill: 50, card: 20, input: 14,
};
