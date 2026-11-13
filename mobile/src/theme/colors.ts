/**
 * Design tokens (violet / soft-card identity)
 */
export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  gradientStart: string;
  gradientEnd: string;
  background: string;
  card: string;
  surface: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textTertiary: string;
  border: string;
  divider: string;
  success: string;
  danger: string;
  warning: string;
  error: string;
  ownMessageBg: string;
  ownMessageText: string;
  otherMessageBg: string;
  otherMessageText: string;
  timestamp: string;
  placeholder: string;
  inputBg: string;
  inputBorder: string;
  shadow: string;
  tabActive: string;
  tabInactive: string;
  tabBg: string;
  skeleton: string;
  lightBlue100: string;
  lightBlue50: string;
  blue900: string;
  link: string;
  pillBg: string;
  band: string;
  headerBg: string;
  bodyAccent: string;
  skipBg: string;
  skipText: string;
  accentGreen: string;
  accentYellow: string;
  disabledBtn: string;
  like: string;
  repost: string;
  overlay: string;
  hover: string;
  onPrimary: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ThemeBorderRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  button: number;
  full: number;
  pill: number;
  card: number;
  input: number;
}

const lightColors: ThemeColors = {
  primary: '#6C4DF6',
  primaryDark: '#5638D6',
  primaryLight: '#ECE8FF',
  gradientStart: '#7B5CFA',
  gradientEnd: '#5638D6',
  background: '#F4F2FB',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#1B1730',
  textSecondary: '#5E5A78',
  textMuted: '#8A86A3',
  textTertiary: '#8A86A3',
  border: '#E6E2F5',
  divider: '#E6E2F5',
  success: '#12B886',
  danger: '#E5484D',
  warning: '#F5A524',
  error: '#E5484D',
  ownMessageBg: '#6C4DF6',
  ownMessageText: '#FFFFFF',
  otherMessageBg: '#FFFFFF',
  otherMessageText: '#1B1730',
  timestamp: '#8A86A3',
  placeholder: '#8A86A3',
  inputBg: '#ECE9F8',
  inputBorder: '#D9D4EE',
  shadow: 'rgba(60, 40, 140, 0.14)',
  tabActive: '#6C4DF6',
  tabInactive: '#8A86A3',
  tabBg: '#FFFFFF',
  skeleton: '#E6E2F5',
  lightBlue100: '#DCD4FF',
  lightBlue50: '#ECE8FF',
  blue900: '#1B1730',
  link: '#6C4DF6',
  pillBg: '#ECE9F8',
  band: '#ECE9F8',
  headerBg: '#F4F2FB',
  bodyAccent: '#1B1730',
  skipBg: '#ECE8FF',
  skipText: '#6C4DF6',
  accentGreen: '#12B886',
  accentYellow: '#F5A524',
  disabledBtn: '#B9A9FB',
  like: '#FF4D79',
  repost: '#12B886',
  overlay: 'rgba(27, 23, 48, 0.45)',
  hover: '#F4F2FB',
  onPrimary: '#FFFFFF',
} as ThemeColors;

const darkColors: ThemeColors = {
  primary: '#8B72FF',
  primaryDark: '#6C4DF6',
  primaryLight: '#1E1938',
  gradientStart: '#9C86FF',
  gradientEnd: '#6C4DF6',
  background: '#0F0D1A',
  card: '#1A1729',
  surface: '#1A1729',
  text: '#EEEBFA',
  textSecondary: '#A29DBF',
  textMuted: '#7E7999',
  textTertiary: '#7E7999',
  border: '#2A2640',
  divider: '#2A2640',
  success: '#2BD4A0',
  danger: '#FF6369',
  warning: '#FFB84D',
  error: '#FF6369',
  ownMessageBg: '#7357F0',
  ownMessageText: '#FFFFFF',
  otherMessageBg: '#221F36',
  otherMessageText: '#EEEBFA',
  timestamp: '#7E7999',
  placeholder: '#7E7999',
  inputBg: '#221F36',
  inputBorder: '#2F2B49',
  shadow: 'rgba(0, 0, 0, 0.5)',
  tabActive: '#8B72FF',
  tabInactive: '#7E7999',
  tabBg: '#1A1729',
  skeleton: '#221F36',
  lightBlue100: '#2A2350',
  lightBlue50: '#1E1938',
  blue900: '#EEEBFA',
  link: '#A594FF',
  pillBg: '#221F36',
  band: '#1A1729',
  headerBg: '#0F0D1A',
  bodyAccent: '#EEEBFA',
  skipBg: '#1E1938',
  skipText: '#A594FF',
  accentGreen: '#2BD4A0',
  accentYellow: '#FFB84D',
  disabledBtn: '#3D3470',
  like: '#FF6B8E',
  repost: '#2BD4A0',
  overlay: 'rgba(0, 0, 0, 0.6)',
  hover: '#141122',
  onPrimary: '#FFFFFF',
} as ThemeColors;

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  gradientStart: string;
  gradientEnd: string;
  background: string;
  card: string;
  surface: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textTertiary: string;
  border: string;
  divider: string;
  success: string;
  danger: string;
  warning: string;
  error: string;
  ownMessageBg: string;
  ownMessageText: string;
  otherMessageBg: string;
  otherMessageText: string;
  timestamp: string;
  placeholder: string;
  inputBg: string;
  inputBorder: string;
  shadow: string;
  tabActive: string;
  tabInactive: string;
  tabBg: string;
  skeleton: string;
  lightBlue100: string;
  lightBlue50: string;
  blue900: string;
  link: string;
  pillBg: string;
  band: string;
  headerBg: string;
  bodyAccent: string;
  skipBg: string;
  skipText: string;
  accentGreen: string;
  accentYellow: string;
  disabledBtn: string;
  like: string;
  repost: string;
  overlay: string;
  hover: string;
  onPrimary: string;
}

export const Colors = {
  ...lightColors,
  light: lightColors,
  dark: darkColors,
} as ThemeColors & { light: ThemeColors; dark: ThemeColors };

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ThemeBorderRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  button: number;
  full: number;
  pill: number;
  card: number;
  input: number;
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as ThemeSpacing;

export const BorderRadius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  button: 16,
  full: 999,
  pill: 50,
  card: 22,
  input: 16,
} as ThemeBorderRadius;