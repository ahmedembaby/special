import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getLockSettings, LockSettings } from '../services/appLock';
import { useAuth } from './AuthContext';

// Leaving the app briefly (photo picker, permission dialogs, notification shade) must not re-lock it
const GRACE_MS = 30 * 1000;

interface Ctx {
  locked: boolean;
  ready: boolean;
  settings: LockSettings;
  refresh: () => Promise<void>;
  unlock: () => void;
}

const AppLockContext = createContext<Ctx>({
  locked: false, ready: true, settings: { pinEnabled: false, biometricEnabled: false }, refresh: async () => {}, unlock: () => {},
});

export const AppLockProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, loading } = useAuth();
  const [settings, setSettings] = useState<LockSettings>({ pinEnabled: false, biometricEnabled: false });
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const leftAt = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const refresh = useCallback(async () => {
    const s = await getLockSettings();
    setSettings(s);
    if (!s.pinEnabled) setLocked(false);
  }, []);

  // Cold start: lock immediately when a PIN exists and the user is signed in
  useEffect(() => {
    if (loading || ready) return;
    getLockSettings().then((s) => {
      setSettings(s);
      if (s.pinEnabled && token) setLocked(true);
      setReady(true);
    });
  }, [loading, token, ready]);

  // Signing in on a device that already has a PIN does not ask for it again; signing out clears the lock state
  useEffect(() => { if (!token) setLocked(false); }, [token]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (leftAt.current === null) leftAt.current = Date.now();
      } else if (state === 'active') {
        const away = leftAt.current;
        leftAt.current = null;
        if (away !== null && settingsRef.current.pinEnabled && Date.now() - away >= GRACE_MS) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <AppLockContext.Provider value={{ ready, locked: locked && !!token, settings, refresh, unlock: () => setLocked(false) }}>
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = () => useContext(AppLockContext);
