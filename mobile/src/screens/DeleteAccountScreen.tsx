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
        <Text style={{ color: c.text, fontSize: 16, lineHeight: 23 }}>
          Deleting your account permanently removes your profile, posts, comments, stories and messages. This cannot be undone.
        </Text>
        <Text style={{ color: c.textSecondary }}>Type DELETE to confirm:</Text>
        <TextInput value={text} onChangeText={setText} autoCapitalize="characters" style={[styles.input, { color: c.text, borderColor: c.border }]} />
        <TouchableOpacity disabled={text !== 'DELETE' || busy} onPress={go} style={[styles.btn, { backgroundColor: c.danger, opacity: text === 'DELETE' && !busy ? 1 : 0.4 }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{busy ? 'Deleting…' : 'Delete my account'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  btn: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
