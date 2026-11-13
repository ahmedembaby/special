import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';

const BIOMETRIC_ENABLED_KEY = 'echat_biometric_enabled';
const LAST_UNLOCK_KEY = 'echat_last_unlock';
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export const useBiometric = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<
    | LocalAuthentication.AuthenticationType
    | null
  >(null);

  const checkAvailability = async () => {
    const available = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsAvailable(available && enrolled);

    if (available && enrolled) {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setBiometricType(types[0] ?? null);
    }
  };

  const authenticate = async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to open E-Chat',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  };

  const shouldPromptBiometric = async () => {
    if (!isEnabled || !isAvailable) return false;

    const lastUnlock = await AsyncStorage.getItem(LAST_UNLOCK_KEY);
    if (!lastUnlock) return true;

    const elapsed = Date.now() - parseInt(lastUnlock, 10);
    return elapsed > INACTIVITY_TIMEOUT;
  };

  const recordUnlockTime = async () => {
    await AsyncStorage.setItem(LAST_UNLOCK_KEY, Date.now().toString());
  };

  const toggleBiometric = async (enabled: boolean) => {
    if (enabled && !isAvailable) return false;
    setIsEnabled(enabled);
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, String(enabled));
    return true;
  };

  const loadBiometricSetting = async () => {
    const saved = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    setIsEnabled(saved === 'true');
  };

  return {
    isEnabled,
    isAvailable,
    biometricType,
    checkAvailability,
    authenticate,
    shouldPromptBiometric,
    recordUnlockTime,
    toggleBiometric,
    loadBiometricSetting,
  };
};
