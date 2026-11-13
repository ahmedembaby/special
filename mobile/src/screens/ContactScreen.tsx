import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as api from '../services/api';
import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { Colors, Typography, Spacing } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
import rawApi from '../services/api';

export default function ContactScreen() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const [users, setUsers] = useState<api.User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users
      .list()
      .then((res) => setUsers(res.data || []))
      .catch(() => Alert.alert('Error', 'Could not load contacts'))
      .finally(() => setLoading(false));
  }, []);

  const [remote, setRemote] = useState<api.User[]>([]);
  const [fromContacts, setFromContacts] = useState<Array<api.User & { contactName?: string }> | null>(null);
  const [syncing, setSyncing] = useState(false);

  // search the whole directory too: by name, @username or phone number
  useEffect(() => {
    const q = search.trim();
    if (q.length < 3) { setRemote([]); return undefined; }
    const t = setTimeout(() => {
      rawApi.get('/search/users', { params: { q } }).then((r) => setRemote(r.data || [])).catch(() => setRemote([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const findFromContacts = async () => {
    setSyncing(true);
    try {
      const Contacts = await import('expo-contacts');
      const perm = await Contacts.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow access to your contacts to find friends who use the app.'); return; }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
      const tails = new Map<string, string>(); // last 9 digits -> contact name
      const phones: string[] = [];
      for (const ct of data) {
        for (const p of ct.phoneNumbers || []) {
          const digits = String(p.number || '').replace(/\D/g, '');
          if (digits.length >= 7) { phones.push(digits); tails.set(digits.slice(-9), ct.name || ''); }
        }
      }
      const res = await api.users.lookupPhones([...new Set(phones)].slice(0, 1000));
      setFromContacts(res.data.map((u) => ({ ...u, contactName: tails.get(u.phone_tail) })));
    } catch {
      Alert.alert('Error', 'Could not read your contacts. (This feature needs a build with the contacts permission.)');
    } finally {
      setSyncing(false);
    }
  };

  const local = users.filter((u) => (u.name || '').toLowerCase().includes(search.toLowerCase()));
  const filtered = [...local, ...remote.filter((r) => !local.some((l) => String(l.id) === String(r.id)))];
  const list = !search.trim() && fromContacts ? fromContacts : filtered;

  const startChat = (user: api.User) => {
    api.conversations
      .create({ participantIds: [user.id], type: 'direct', name: '' })
      .then((res) => navigation.navigate('Chat', { conversationId: res.data.id }))
      .catch(() => Alert.alert('Error', 'Could not start chat'));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Header
        title="Contacts"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        onRightPress={() => navigation.navigate('GroupChat')}
        rightIcon="users"
        rightText="New group"
      />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, @username or phone" />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContent, { backgroundColor: c.background }]}
          data={list}
          ListHeaderComponent={
            !search.trim() ? (
              <TouchableOpacity style={{ padding: 14, flexDirection: 'row', gap: 8, alignItems: 'center' }} onPress={fromContacts ? () => setFromContacts(null) : findFromContacts} disabled={syncing}>
                <Text style={{ color: c.primary, fontWeight: '700' }}>
                  {syncing ? 'Searching your contacts…' : fromContacts ? `${fromContacts.length} of your contacts are on the app — tap to show everyone` : '📇 Find friends from your contacts'}
                </Text>
              </TouchableOpacity>
            ) : undefined
          }
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={<EmptyState icon="users" title="No contacts" subtitle="No users found." />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { borderBottomColor: c.border, backgroundColor: c.background }]}
              onPress={() => startChat(item)}
              activeOpacity={0.85}
            >
              <Avatar source={item.avatar} name={item.name} size={52} status={item.status} userId={item.id} />
              <View style={styles.body}>
                <Text style={[styles.name, { color: c.text, fontWeight: '600' }]}>{item.name}</Text>
                <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                  {(item as any).contactName ? `${(item as any).contactName} · ` : ''}{item.username ? `@${item.username}` : item.status === 'online' ? 'Online' : 'Offline'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { flexGrow: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  body: { flex: 1, marginLeft: 12 },
  name: { ...Typography.body, color: '#1B1730', fontWeight: '600' },
  subtitle: { ...Typography.caption, color: '#5E5A78', marginTop: 2 },
});
