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

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await secureGet(PIN_KEY);
  return !!stored && stored === pin;
}

export async function disableLock(): Promise<void> {
  try { await SecureStore.deleteItemAsync(PIN_KEY); } catch {}
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
