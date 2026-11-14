import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Returns the Expo push token, or null when not available (simulator, permission denied, Expo Go limits...). */
export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 800, 400, 800, 400, 800],
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    if (!Device.isDevice) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (finalStatus !== 'granted') {
      finalStatus = (await Notifications.requestPermissionsAsync()).status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return res.data;
  } catch {
    return null;
  }
};

export const sendPushTokenToServer = async (token: string) => {
  try {
    await api.auth.pushRegister({ token });
    await AsyncStorage.setItem('push_token', token);
  } catch {
    // push is optional
  }
};

/** Registers this device for push and tells the server. Safe to call on every launch. */
export const syncPushToken = async () => {
  const token = await registerForPushNotificationsAsync();
  if (!token) return;
  if ((await AsyncStorage.getItem('push_token').catch(() => null)) === token) return; // server already has it
  await sendPushTokenToServer(token);
};
