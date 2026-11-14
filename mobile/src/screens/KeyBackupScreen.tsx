import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { useAuth } from '../context/AuthContext';
import { ScreenHeader } from '../components/ScreenHeader';
import * as e2ee from '../services/e2ee';

export default function KeyBackupScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const { user } = useAuth();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (kind: 'backup' | 'restore') => {
    if (pass.length < 8) return Alert.alert('Passphrase too short', 'Use at least 8 characters.');
    setBusy(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 50)); // let the spinner render before the CPU-heavy key derivation
      if (kind === 'backup') {
        await e2ee.ensureKeys(user!.id as string, user!.public_key);
        await e2ee.backupKey(user!.id as string, pass);
        Alert.alert('Backed up', 'Your encryption key is saved, protected by your passphrase. Do not forget it: nobody can recover it for you.');
      } else {
        const ok = await e2ee.restoreKey(user!.id as string, pass);
        Alert.alert(ok ? 'Restored' : 'Wrong passphrase', ok ? 'This device can now read your encrypted chats. Re-open the conversations.' : 'The passphrase does not match the backup.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.status === 404 ? 'No backup found for this account.' : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Encryption key backup" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={{ color: c.text, lineHeight: 22 }}>
          Your end-to-end encryption key lives only on this phone. Back it up with a passphrase to keep your encrypted chats after reinstalling, or to read them on a second phone (restore with the same passphrase there).
        </Text>
        <TextInput
          value={pass}
          accessibilityLabel="Encryption backup passphrase"
          accessibilityHint="Enter the same passphrase to restore your encryption key"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPass}
          secureTextEntry
          placeholder="Passphrase (8+ characters)"
          placeholderTextColor={c.placeholder}
          style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
        />
        <TouchableOpacity disabled={busy} onPress={() => run('backup')} style={[styles.btn, { backgroundColor: c.primary, opacity: busy ? 0.65 : 1 }]} accessibilityRole="button" accessibilityLabel="Back up this device encryption key" accessibilityState={{ disabled: busy, busy }}>
          <Text style={styles.btnText}>{busy ? 'Working…' : 'Back up this device’s key'}</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={() => run('restore')} style={[styles.btn, { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, opacity: busy ? 0.65 : 1 }]} accessibilityRole="button" accessibilityLabel="Restore encryption key on this device" accessibilityState={{ disabled: busy, busy }}>
          <Text style={[styles.btnText, { color: c.text }]}>Restore the key on this device</Text>
        </TouchableOpacity>
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>
          Restoring replaces this device’s key with the backed-up one. Messages sent while this device had a different key stay unreadable.
        </Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 15, fontSize: 16 },
  btn: { minHeight: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
