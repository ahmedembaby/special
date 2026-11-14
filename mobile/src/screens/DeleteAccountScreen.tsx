import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
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

  const go = async () => {
    setBusy(true);
    try {
      await api.safety.deleteAccount();
      await logout().catch(() => {});
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not delete the account');
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
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
        <TouchableOpacity disabled={text !== 'DELETE' || busy} onPress={go} accessibilityRole="button" accessibilityLabel="Permanently delete my account" accessibilityState={{ disabled: text !== 'DELETE' || busy, busy }} style={[styles.btn, { backgroundColor: c.danger, opacity: text === 'DELETE' && !busy ? 1 : 0.4 }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{busy ? 'Deleting…' : 'Delete my account'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16 },
  btn: { minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
});
