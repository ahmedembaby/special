import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useAppColors } from '../theme/useAppColors';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/Icon';
import * as api from '../services/api';

export default function SessionsScreen() {
  const navigation = useNavigation() as any;
  const { c } = useAppColors();
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<api.DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await api.auth.sessions(); setSessions(result.data || []); }
    catch { Alert.alert('Error', 'Could not load connected devices. Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const revoke = (item: api.DeviceSession) => Alert.alert(
    item.is_current ? 'Sign out this device?' : 'Sign out device?',
    item.is_current ? 'You will be signed out of Special on this device.' : 'This device will no longer be able to access your account.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => {
      setBusy(item.id);
      try { const result = await api.auth.revokeSession(item.id); if (result.data.current) await logout(); else await load(); }
      catch { Alert.alert('Error', 'Could not revoke this session.'); }
      finally { setBusy(null); }
    } }]
  );
  const date = (value: string) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString(); };
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Devices and sessions" onBack={() => navigation.goBack()} />
      {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 32 }} /> : (
        <FlatList data={sessions} keyExtractor={(item) => item.id} contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 30 }}>No active sessions found.</Text>}
          ListHeaderComponent={<Text style={{ color: c.textSecondary, marginBottom: 12 }}>Sessions currently authorized to access your Special account.</Text>}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: c.card, borderRadius: 16, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' }}><Icon name={item.platform === 'web' ? 'file' : 'phone'} size={21} color={c.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{item.device_name || 'Unknown device'}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 3 }}>{String(item.platform || 'unknown').toUpperCase()} · Last active {date(item.last_active_at)}</Text>
                <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>Signed in {date(item.created_at)}</Text>
                {item.is_current ? <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12, marginTop: 4 }}>This device · Current session</Text> : null}
              </View>
              <TouchableOpacity disabled={busy === item.id} onPress={() => revoke(item)} style={{ padding: 8 }}>{busy === item.id ? <ActivityIndicator color={c.danger} /> : <Icon name="logout" size={20} color={c.danger} />}</TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}
