import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as api from '../services/api';
import { useAppColors } from '../theme/useAppColors';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/Icon';

/** Two-step verification (TOTP): works with Google Authenticator, Authy, 1Password, etc. */
export default function TwoFactorScreen() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setEnabled((await api.auth.twoFactorStatus()).data.enabled); } catch { setEnabled(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const fail = (e: any, fallback: string) => Alert.alert('Error', e?.response?.data?.message || fallback);

  const start = async () => {
    setBusy(true);
    try { setSetup((await api.auth.twoFactorSetup()).data); setCode(''); } catch (e) { fail(e, 'Could not start setup'); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true);
    try { await api.auth.twoFactorEnable(code); setSetup(null); setCode(''); setEnabled(true); Alert.alert('Enabled', 'Two-step verification is now on.'); }
    catch (e) { fail(e, 'Invalid code'); } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try { await api.auth.twoFactorDisable(code); setCode(''); setEnabled(false); } catch (e) { fail(e, 'Invalid code'); } finally { setBusy(false); }
  };
  const openApp = () => setup && Linking.openURL(setup.otpauthUrl).catch(() => Alert.alert('No authenticator app', 'Install an authenticator app, then add the key manually.'));

  const groups = setup ? setup.secret.match(/.{1,4}/g)?.join(' ') : '';
  const Btn = ({ title, onPress, disabled, danger }: any) => (
    <TouchableOpacity onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy }}
      style={[styles.btn, { backgroundColor: danger ? c.danger : c.primary, opacity: disabled || busy ? 0.5 : 1 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{title}</Text>}
    </TouchableOpacity>
  );
  const CodeInput = () => (
    <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6}
      placeholder="000000" placeholderTextColor={c.textMuted} accessibilityLabel="Six digit authenticator code"
      style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.inputBg }]} />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['left', 'right']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader title="Two-step verification" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {enabled === null ? <ActivityIndicator color={c.primary} /> : enabled ? (
          <>
            <Text style={[styles.lead, { color: c.text }]}>Two-step verification is ON</Text>
            <Text style={[styles.body, { color: c.textSecondary }]}>Signing in on a new device needs a code from your authenticator app. To turn it off, enter a current code.</Text>
            <CodeInput />
            <Btn title="Turn off" danger disabled={code.length !== 6} onPress={disable} />
          </>
        ) : setup ? (
          <>
            <Text style={[styles.lead, { color: c.text }]}>1. Add the key to your authenticator app</Text>
            <TouchableOpacity onPress={openApp} accessibilityRole="button" accessibilityLabel="Open authenticator app"><Text style={{ color: c.primary, marginBottom: 10, fontWeight: '700' }}>Open authenticator app</Text></TouchableOpacity>
            <Text selectable accessibilityLabel={`Setup key ${groups}`} style={[styles.secret, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}>{groups}</Text>
            <Text style={[styles.body, { color: c.textSecondary }]}>If the app does not open, add a new account manually and type this key (time based).</Text>
            <Text style={[styles.lead, { color: c.text, marginTop: 14 }]}>2. Enter the 6-digit code</Text>
            <CodeInput />
            <Btn title="Turn on" disabled={code.length !== 6} onPress={confirm} />
          </>
        ) : (
          <>
            <Text style={[styles.lead, { color: c.text }]}>Protect your account</Text>
            <Text style={[styles.body, { color: c.textSecondary }]}>Add a second step: a 6-digit code from an authenticator app is required whenever someone signs in to your account.</Text>
            <Btn title="Set up" onPress={start} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  lead: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 21, marginBottom: 14 },
  secret: { fontSize: 18, fontWeight: '700', letterSpacing: 1.5, padding: 14, borderRadius: 12, borderWidth: 1, textAlign: 'center', marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 24, textAlign: 'center', letterSpacing: 6, marginBottom: 14 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
