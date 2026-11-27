import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { useAuth } from '../context/AuthContext';
import { ScreenHeader } from '../components/ScreenHeader';
import * as api from '../services/api';

export default function DeleteAccountScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const { logout } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // How the owner proves it is them before the account is erased (an older server answers 404: no extra step)
  const [method, setMethod] = useState<'totp' | 'password' | 'otp' | null>(null);
  const [proof, setProof] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  useEffect(() => {
    api.safety.deleteAccountReauth().then((r) => setMethod(r.data.method)).catch(() => setMethod(null));
  }, []);

  const sendCode = async () => {
    setBusy(true);
    try { await api.safety.deleteAccountCode(); setCodeSent(true); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.message || 'Could not send the code'); }
    setBusy(false);
  };

  const needsProof = method !== null;
  const proofReady = !needsProof || (method === 'otp' ? codeSent && proof.trim().length > 0 : proof.trim().length > 0);

  const go = async () => {
    setBusy(true);
    try {
      const value = proof.trim();
      await api.safety.deleteAccount(method === 'totp' ? { totp: value } : method === 'password' ? { password: proof } : method === 'otp' ? { code: value } : undefined);
      await logout().catch(() => {});
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not delete the account');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior="padding">
      <ScreenHeader title="Delete account" onBack={() => nav.goBack()} />
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ backgroundColor: c.card, borderColor: c.danger, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16, gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: c.danger, fontSize: 16, fontWeight: '800' }}>This action is permanent</Text>
          <Text style={{ color: c.text, fontSize: 15, lineHeight: 23 }}>
          Deleting your account permanently removes your profile, posts, comments, stories and messages. This cannot be undone.
          </Text>
        </View>
        <Text style={{ color: c.textSecondary, fontWeight: '600' }}>Type DELETE to confirm:</Text>
        <TextInput value={text} onChangeText={setText} accessibilityLabel="Type DELETE to confirm account deletion" autoCapitalize="characters" autoCorrect={false} style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]} />
        {method ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: c.textSecondary, fontWeight: '600' }}>
              {method === 'totp' ? 'Enter the code from your authenticator app:' : method === 'password' ? 'Enter your password:' : 'We will send a code to your WhatsApp number:'}
            </Text>
            {method === 'otp' ? (
              <TouchableOpacity disabled={busy} onPress={sendCode} accessibilityRole="button" accessibilityLabel="Send verification code" style={[styles.btn, { backgroundColor: c.surface }]}>
                <Text style={{ color: c.text, fontWeight: '700' }}>{codeSent ? 'Send a new code' : 'Send code'}</Text>
              </TouchableOpacity>
            ) : null}
            {method !== 'otp' || codeSent ? (
              <TextInput
                value={proof}
                onChangeText={setProof}
                accessibilityLabel={method === 'password' ? 'Password' : 'Verification code'}
                secureTextEntry={method === 'password'}
                keyboardType={method === 'password' ? 'default' : 'number-pad'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
              />
            ) : null}
          </View>
        ) : null}
        <TouchableOpacity disabled={text !== 'DELETE' || busy || !proofReady} onPress={go} accessibilityRole="button" accessibilityLabel="Permanently delete my account" accessibilityState={{ disabled: text !== 'DELETE' || busy || !proofReady, busy }} style={[styles.btn, { backgroundColor: c.danger, opacity: text === 'DELETE' && !busy && proofReady ? 1 : 0.4 }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{busy ? 'Deleting…' : 'Delete my account'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16 },
  btn: { minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
});
