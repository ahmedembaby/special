import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * App lock: a 4-digit PIN (kept in the OS keychain/keystore) plus optional biometrics.
 * Biometrics only unlock the app; the PIN stays the fallback and is required to turn them on.
 */
const PIN_KEY = 'echat_app_pin';
const BIO_KEY = 'echat_biometric_enabled';

export interface LockSettings {
  pinEnabled: boolean;
  biometricEnabled: boolean;
}

const secureGet = async (k: string) => { try { return await SecureStore.getItemAsync(k); } catch { return null; } };

export async function getLockSettings(): Promise<LockSettings> {
  const pin = await secureGet(PIN_KEY);
  let bio: string | null = null;
  try { bio = await AsyncStorage.getItem(BIO_KEY); } catch {}
  return { pinEnabled: !!pin, biometricEnabled: !!pin && bio === 'true' };
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

// Failed-attempt state lives in the keystore, so closing or restarting the app does not reset it.
const FAIL_KEY = 'echat_pin_fail_state';
export const PIN_MAX_TRIES = 5;
const BASE_LOCK_S = 30;
const MAX_LOCK_S = 3600;
// total = wrong PINs in a row since the last correct one (never reset by a lockout ending). At PIN_SIGNOUT_TRIES the app signs the user out.
export const PIN_SIGNOUT_TRIES = 10;
interface FailState { fails: number; lockouts: number; until: number; total: number }
const EMPTY_FAIL: FailState = { fails: 0, lockouts: 0, until: 0, total: 0 };

async function readFail(): Promise<FailState> {
  const raw = await secureGet(FAIL_KEY);
  if (!raw) return { ...EMPTY_FAIL };
  try {
    const v = JSON.parse(raw);
    return { fails: Number(v.fails) || 0, lockouts: Number(v.lockouts) || 0, until: Number(v.until) || 0, total: Number(v.total) || 0 };
  } catch { return { ...EMPTY_FAIL }; }
}
const writeFail = async (st: FailState) => { try { await SecureStore.setItemAsync(FAIL_KEY, JSON.stringify(st)); } catch {} };

/** Seconds left before another PIN try is allowed (0 = not locked out). */
export async function getPinLockoutSeconds(): Promise<number> {
  const st = await readFail();
  return Math.max(0, Math.ceil((st.until - Date.now()) / 1000));
}

/** Tries left before the next lockout. */
export async function getPinTriesLeft(): Promise<number> {
  const st = await readFail();
  return Math.max(0, PIN_MAX_TRIES - st.fails);
}

/** Returns false while locked out; each lockout doubles the wait (30s, 60s, ... up to 1h). */
export async function verifyPin(pin: string): Promise<boolean> {
  const st = await readFail();
  if (st.until > Date.now()) return false;
  const stored = await secureGet(PIN_KEY);
  if (!!stored && stored === pin) {
    if (st.fails || st.lockouts || st.until || st.total) await writeFail({ ...EMPTY_FAIL });
    return true;
  }
  const total = st.total + 1;
  const fails = st.fails + 1;
  if (fails >= PIN_MAX_TRIES) {
    const lockouts = st.lockouts + 1;
    const wait = Math.min(MAX_LOCK_S, BASE_LOCK_S * 2 ** (lockouts - 1));
    await writeFail({ fails: 0, lockouts, until: Date.now() + wait * 1000, total });
  } else {
    await writeFail({ ...st, fails, total });
  }
  return false;
}

/** True once PIN_SIGNOUT_TRIES wrong PINs in a row were entered: the lock screen must sign the user out. */
export async function pinSignOutDue(): Promise<boolean> {
  return (await readFail()).total >= PIN_SIGNOUT_TRIES;
}

/** Clears the failed-attempt state (after a sign-out or a fresh phone/OTP login, which proves ownership). */
export async function resetPinFailState(): Promise<void> {
  try { await SecureStore.deleteItemAsync(FAIL_KEY); } catch {}
}

export async function disableLock(): Promise<void> {
  try { await SecureStore.deleteItemAsync(PIN_KEY); } catch {}
  try { await SecureStore.deleteItemAsync(FAIL_KEY); } catch {}
  try { await AsyncStorage.removeItem(BIO_KEY); } catch {}
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(BIO_KEY, on ? 'true' : 'false');
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function authenticateBiometric(prompt = 'Unlock E-Chat'): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: 'Use PIN', disableDeviceFallback: true });
    return !!res.success;
  } catch {
    return false;
  }
}
