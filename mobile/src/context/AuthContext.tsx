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
          setMediaToken(t);
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
    setMediaToken(newToken);
    setUser(userData || null);
    setToken(newToken);
  }, []);

  const logout = useCallback(async () => {
    // Invalidate the token on the server (best effort) before dropping it locally
    try { await api.auth.logout(); } catch { /* offline or already invalid */ }
    await Promise.all([SecureStore.deleteItemAsync('echat_token'), AsyncStorage.multiRemove(['echat_token', 'echat_user', 'push_token'])]);
    queryClient.clear(); // never show the previous account's cached data
    cacheClear();
    setMediaToken(null);
    setUser(null);
    setToken(null);
  }, []);

  // One realtime connection per session
  useEffect(() => {
    if (token) { connectSocket(token); startOutbox(); }
    else { disconnectSocket(); stopOutbox(); }
    return () => { /* kept alive across re-renders; closed on logout */ };
  }, [token]);

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
      Promise.all([SecureStore.deleteItemAsync('echat_token'), AsyncStorage.multiRemove(['echat_token', 'echat_user', 'push_token'])]).catch(() => {});
      setMediaToken(null);
      cacheClear();
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
