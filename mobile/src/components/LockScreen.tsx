import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import { useAppLock } from '../context/AppLockContext';
import { useAuth } from '../context/AuthContext';
import { Icon } from './Icon';
import { verifyPin, authenticateBiometric } from '../services/appLock';

const MAX_TRIES = 5;
const LOCKOUT_S = 30;

/** Full-screen overlay shown while the app is locked. */
export default function LockScreen() {
  const { c, isDark } = useAppColors();
  const insets = useSafeAreaInsets();
  const { settings, unlock } = useAppLock();
  const { logout } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [tries, setTries] = useState(0);
  const [wait, setWait] = useState(0);
  const inputRef = useRef<any>(null);

  const tryBiometric = useCallback(async () => {
    if (!settings.biometricEnabled) return;
    if (await authenticateBiometric()) unlock();
  }, [settings.biometricEnabled, unlock]);

  useEffect(() => { tryBiometric(); }, [tryBiometric]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const onChange = async (v: string) => {
    if (wait > 0) return;
    const next = v.replace(/\D/g, '').slice(0, 4);
    setPin(next);
    setError(false);
    if (next.length < 4) return;
    if (await verifyPin(next)) {
      unlock();
      return;
    }
    setError(true);
    setPin('');
    const n = tries + 1;
    if (n >= MAX_TRIES) { setTries(0); setWait(LOCKOUT_S); } else setTries(n);
  };

  const forgot = () =>
    Alert.alert('Forgot PIN?', 'You will be logged out and can sign in again with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Icon name="lock" size={44} color={c.primary} />
      <Text style={[styles.title, { color: c.text }]}>Enter your PIN</Text>
      <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.row}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, { borderColor: error ? c.danger : c.text, backgroundColor: i < pin.length ? c.text : 'transparent' }]} />
        ))}
        <TextInput ref={inputRef} value={pin} onChangeText={onChange} keyboardType="number-pad" maxLength={4} autoFocus caretHidden style={styles.hidden} editable={wait === 0} />
      </TouchableOpacity>
      <Text style={{ color: c.danger, height: 22 }}>
        {wait > 0 ? `Too many attempts. Try again in ${wait}s` : error ? `Wrong PIN (${MAX_TRIES - tries} tries left)` : ''}
      </Text>
      {settings.biometricEnabled ? (
        <TouchableOpacity onPress={tryBiometric} style={styles.link}>
          <Icon name="fingerprint" size={22} color={c.primary} />
          <Text style={{ color: c.primary, fontWeight: '700' }}>Use biometrics</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity onPress={forgot} style={styles.link}>
        <Text style={{ color: c.textSecondary }}>Forgot PIN?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  title: { fontSize: 22, fontWeight: '800', marginTop: 16, marginBottom: 28 },
  row: { flexDirection: 'row', gap: 20, padding: 10 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, padding: 8 },
});
