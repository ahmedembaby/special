import AsyncStorage from '@react-native-async-storage/async-storage';

/** Tiny JSON cache so screens can show the last known data instantly and offline. */
export const cacheGet = async <T,>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(`cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const cacheSet = (key: string, value: unknown) => {
  try {
    AsyncStorage.setItem(`cache:${key}`, JSON.stringify(value)).catch(() => {});
  } catch { /* too large / unavailable */ }
};

export const cacheClear = async () => {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('cache:'));
    await AsyncStorage.multiRemove(keys);
  } catch { /* ignore */ }
};
