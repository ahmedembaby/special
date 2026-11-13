import AsyncStorage from '@react-native-async-storage/async-storage';

/** Per-chat local preferences: drafts, wallpaper and bubble color. */
const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => { try { return await fn(); } catch { return fallback; } };

// ---- drafts ----
const dKey = (id: string | number) => `draft:${id}`;
export const getDraft = (id: string | number) => safe(async () => (await AsyncStorage.getItem(dKey(id))) || '', '');
export const setDraft = (id: string | number, text: string) =>
  safe(async () => { if (text.trim()) await AsyncStorage.setItem(dKey(id), text); else await AsyncStorage.removeItem(dKey(id)); }, undefined);
export const getDrafts = (ids: Array<string | number>) =>
  safe(async () => {
    const rows = await AsyncStorage.multiGet(ids.map(dKey));
    const out: Record<string, string> = {};
    rows.forEach(([k, v], i) => { if (v) out[String(ids[i])] = v; });
    return out;
  }, {} as Record<string, string>);

// ---- theme ----
export interface ChatTheme { wallpaper: string | null; bubble: string | null }
export const NO_THEME: ChatTheme = { wallpaper: null, bubble: null };
const tKey = (id: string | number | 'default') => `chat_theme:${id}`;

export const WALLPAPERS: Array<{ name: string; color: string | null }> = [
  { name: 'Default', color: null },
  { name: 'Lavender', color: '#EFEAFF' },
  { name: 'Mint', color: '#E3F6EE' },
  { name: 'Sky', color: '#E4F1FB' },
  { name: 'Peach', color: '#FDEBDD' },
  { name: 'Rose', color: '#FBE6EE' },
  { name: 'Sand', color: '#F3EEE2' },
  { name: 'Slate', color: '#2B2F3B' },
  { name: 'Midnight', color: '#10131F' },
];
export const BUBBLE_COLORS: Array<{ name: string; color: string | null }> = [
  { name: 'Default', color: null },
  { name: 'Violet', color: '#6C4DF6' },
  { name: 'Ocean', color: '#1E88E5' },
  { name: 'Teal', color: '#0FA37F' },
  { name: 'Coral', color: '#F25C54' },
  { name: 'Amber', color: '#E08A00' },
  { name: 'Pink', color: '#D63384' },
  { name: 'Graphite', color: '#4A5060' },
];

export const getTheme = async (id: string | number): Promise<ChatTheme> =>
  safe(async () => {
    const own = await AsyncStorage.getItem(tKey(id));
    const raw = own || (await AsyncStorage.getItem(tKey('default')));
    return raw ? { ...NO_THEME, ...JSON.parse(raw) } : NO_THEME;
  }, NO_THEME);

/** Saves the theme for this chat, or for every chat without its own theme when `all` is true. */
export const saveTheme = (id: string | number, theme: ChatTheme, all: boolean) =>
  safe(() => AsyncStorage.setItem(tKey(all ? 'default' : id), JSON.stringify(theme)), undefined);

export const isDarkColor = (hex: string | null) => {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128;
};
