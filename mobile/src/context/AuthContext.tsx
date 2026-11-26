import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { setMediaToken } from '../config';
import { cacheClear } from '../services/cache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as api from '../services/api';
import { setUnauthorizedHandler } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { startOutbox, stopOutbox } from '../services/outbox';
import { queryClient } from '../providers/QueryProvider';
import { offlineQueue } from '../utils/offlineQueue';
import { clearChatPrefs, enableChatPrefs } from '../services/chatPrefs';

export interface User {
  id?: string | number;
  name?: string;
  username?: string | null;
  bio?: string | null;
  is_admin?: boolean;
  email?: string | null;
  phone?: string | null;
  gender?: string;
  birthday?: string;
  avatar?: string | null;
  status?: string;
  is_private?: boolean;
  public_key?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (newToken: string, userData?: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);


const MEDIA_KEY = 'echat_media_token';
/**
 * Image/video URLs carry a media-only token (see server /auth/media-token), never the session JWT.
 * The stored token is used immediately; if there is none (first run after the update, or an older server) the session token is
 * the fallback so media keeps loading. wait=true (login) gives the server up to 2.5s to answer before the first screen renders.
 */
const refreshMediaToken = async (sessionToken: string, wait: boolean) => {
  const stored = await SecureStore.getItemAsync(MEDIA_KEY).catch(() => null);
  setMediaToken(stored || sessionToken);
  const fetchIt = api.auth.mediaToken().then(async (r) => {
    const mt = r.data && r.data.token;
    if (mt && mt !== stored) { await SecureStore.setItemAsync(MEDIA_KEY, mt).catch(() => {}); setMediaToken(mt); }
  }).catch(() => { /* older server or offline: keep what we have */ });
  if (wait && !stored) await Promise.race([fetchIt, new Promise<void>((r) => setTimeout(r, 2500))]);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [secureToken, legacyToken, u] = await Promise.all([
          SecureStore.getItemAsync('echat_token'),
          AsyncStorage.getItem('echat_token'),
          AsyncStorage.getItem('echat_user'),
        ]);
        const t = secureToken || legacyToken;
        if (!secureToken && legacyToken) await SecureStore.setItemAsync('echat_token', legacyToken);
        if (legacyToken) await AsyncStorage.removeItem('echat_token');
        if (t) {
          await refreshMediaToken(t, false);
          setToken(t);
          setUser(u ? JSON.parse(u) : null);
          // Refresh the profile in the background (a 401 here logs out through the interceptor)
          api.users.me().then((r) => {
            setUser((prev) => {
              const next = { ...(prev || {}), ...r.data };
              AsyncStorage.setItem('echat_user', JSON.stringify(next)).catch(() => {});
              return next;
            });
          }).catch(() => {});
        }
      } catch {
        await AsyncStorage.multiRemove(['echat_token', 'echat_user']);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (newToken: string, userData?: User) => {
    // The token must be in storage before any screen mounts and fires requests
    await SecureStore.setItemAsync('echat_token', newToken);
    await AsyncStorage.setItem('echat_user', JSON.stringify(userData || {}));
    // Fresh login: force the device token to be sent again for this account (see PushNavigationHandler)
    await AsyncStorage.removeItem('push_token').catch(() => {});
    queryClient.clear();
    enableChatPrefs();
    await SecureStore.deleteItemAsync(MEDIA_KEY).catch(() => {});
    await refreshMediaToken(newToken, true);
    setUser(userData || null);
    setToken(newToken);
  }, []);

  const logout = useCallback(async () => {
    // Stop offline replay and wipe this account's queued mutations before the session goes away
    await offlineQueue.deactivate({ clearStored: true });
    // Invalidate the token on the server (best effort) before dropping it locally
    try { await api.auth.logout(); } catch { /* offline or already invalid */ }
    await Promise.all([SecureStore.deleteItemAsync('echat_token'), SecureStore.deleteItemAsync(MEDIA_KEY).catch(() => {}), AsyncStorage.multiRemove(['echat_token', 'echat_user', 'push_token'])]);
    queryClient.clear(); // never show the previous account's cached data
    cacheClear();
    clearChatPrefs();
    setMediaToken(null);
    setUser(null);
    setToken(null);
  }, []);

  // One realtime connection per session
  useEffect(() => {
    if (token) {
      connectSocket(token);
      if (user?.id !== undefined && user?.id !== null) { startOutbox(user.id); offlineQueue.setOwner(String(user.id)).catch(() => {}); }
      else { stopOutbox(); offlineQueue.deactivate().catch(() => {}); }
    } else { disconnectSocket(); stopOutbox(); offlineQueue.deactivate().catch(() => {}); }
    return () => { /* kept alive across re-renders; closed on logout */ };
  }, [token, user?.id]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...patch };
      AsyncStorage.setItem('echat_user', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    // On 401 the token is already invalid: just drop the local session (no server call)
    const handler = () => {
      offlineQueue.deactivate().catch(() => {}); // stop replay; the account's stored queue stays for its next login
      Promise.all([SecureStore.deleteItemAsync('echat_token'), SecureStore.deleteItemAsync(MEDIA_KEY).catch(() => {}), AsyncStorage.multiRemove(['echat_token', 'echat_user', 'push_token'])]).catch(() => {});
      setMediaToken(null);
      cacheClear();
      clearChatPrefs();
      queryClient.clear();
      setUser(null);
      setToken(null);
    };
    setUnauthorizedHandler(handler);
    return () => setUnauthorizedHandler(() => {});
  }, [logout]);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, updateUser }),
    [user, token, loading, login, logout, updateUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
