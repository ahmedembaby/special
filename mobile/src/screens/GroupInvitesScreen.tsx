import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useAppColors } from '../theme/useAppColors';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { groups as groupsApi, GroupInvite } from '../services/groups';
import { onSocket } from '../services/socket';

/** Invitations other people sent me to join their groups. */
export default function GroupInvitesScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const qc = useQueryClient();
  const [items, setItems] = useState<GroupInvite[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems((await groupsApi.myInvites()).data || []); } catch { setItems([]); }
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => onSocket('notification', (n: any) => { if (n?.type === 'group_invite') load(); }), [load]);

  const answer = async (inv: GroupInvite, accept: boolean) => {
    setBusy(inv.token);
    try {
      if (accept) { await groupsApi.acceptInvite(inv.token); qc.invalidateQueries(); }
      else await groupsApi.declineInvite(inv.token);
      setItems((prev) => (prev || []).filter((i) => i.token !== inv.token));
      if (accept) Alert.alert('Joined', `You joined “${inv.group_name}”.`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not answer the invitation');
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader title="Group invitations" onBack={() => nav.goBack()} />
      {items === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      ) : (
        <FlatList
          data={items}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 32, flexGrow: 1 }}
          keyExtractor={(i) => i.token}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} />}
          ListEmptyComponent={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 56 }}><Text accessibilityRole="header" style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>No pending invitations</Text><Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 7, lineHeight: 20 }}>When someone invites you to a group, it will appear here.</Text></View>}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
              <Avatar source={item.group_avatar} name={item.group_name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{item.group_name}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 13 }}>Invited by {item.inviter_name}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity disabled={busy === item.token} onPress={() => answer(item, true)} accessibilityRole="button" accessibilityLabel={`Join ${item.group_name}`} accessibilityState={{ disabled: busy === item.token, busy: busy === item.token }} style={[styles.btn, { backgroundColor: c.primary, opacity: busy === item.token ? 0.6 : 1 }]}>
                    <Text style={{ color: c.background, fontWeight: '800' }}>Join</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={busy === item.token} onPress={() => answer(item, false)} accessibilityRole="button" accessibilityLabel={`Decline invitation to ${item.group_name}`} accessibilityState={{ disabled: busy === item.token, busy: busy === item.token }} style={[styles.btn, { borderWidth: 1, borderColor: c.border, backgroundColor: c.background, opacity: busy === item.token ? 0.6 : 1 }]}>
                    <Text style={{ color: c.text, fontWeight: '800' }}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, marginBottom: 10, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  btn: { borderRadius: 15, paddingHorizontal: 18, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
});
