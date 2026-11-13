import { useState, useCallback, useEffect } from 'react';
import { cacheGet, cacheSet } from '../services/cache';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Modal, Pressable, StyleSheet, StatusBar } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';
import { useAppColors } from '../theme/useAppColors';
import { useMe } from '../hooks/useMe';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchBar } from '../components/SearchBar';
import { ChatItem, getChatName } from '../components/ChatItem';
import { Icon } from '../components/Icon';
import { onSocket } from '../services/socket';
import { getDrafts } from '../services/chatPrefs';
import { useI18n } from '../i18n';

/** "Messages" tab — same data as before (your chat backend), restyled like X DMs. */
export default function ChatsScreen() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const { t, lang } = useI18n();
  const me = useMe();
  const [conversations, setConversations] = useState<api.Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [menu, setMenu] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.conversations.list();
      setConversations(res.data || []);
      cacheSet('conversations', res.data || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { cacheGet<api.Conversation[]>('conversations').then((c) => { if (c) { setConversations((cur) => (cur.length ? cur : c)); setLoading(false); } }); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => {
    if (conversations.length) getDrafts(conversations.map((cv) => cv.id)).then(setDrafts);
  }, [conversations]));

  // Live updates: any message / read / membership change refreshes the list (debounced)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (t) clearTimeout(t);
      t = setTimeout(load, 250);
    };
    const offs = ['conversation_message', 'conversation_updated', 'conversation_removed', 'conversation_read'].map((e) => onSocket(e, refresh));
    return () => { offs.forEach((off) => off()); if (t) clearTimeout(t); };
  }, [load]);

  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = conversations.filter((cv) => cv.archived).length;
  const filtered = conversations.filter((cv) => !!cv.archived === showArchived && getChatName(cv).toLowerCase().includes(search.toLowerCase()));

  const go = (name: string) => { setMenu(false); navigation.navigate(name); };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader
        title="Messages"
        avatarUri={me.avatar}
        avatarName={me.name}
        onAvatarPress={() => navigation.navigate('Profile')}
        rightIcon="settings"
        onRightPress={() => navigation.navigate('Profile', { screen: 'Settings' })}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search chats" />
        </View>
      </ScreenHeader>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      ) : (
        <FlatList
          data={filtered}
          ListHeaderComponent={
            search.trim().length >= 2 ? (
              <TouchableOpacity onPress={() => navigation.navigate('GlobalSearch', { q: search.trim() })} style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Icon name="search" size={17} color={c.primary} />
                <Text style={{ color: c.primary, fontWeight: '700' }}>{t('Search')} “{search.trim()}” in all messages</Text>
              </TouchableOpacity>
            ) : archivedCount > 0 || showArchived ? (
              <TouchableOpacity onPress={() => setShowArchived((v) => !v)} style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Icon name={showArchived ? (lang === 'ar' ? 'arrowRight' : 'arrowLeft') : 'archive'} size={17} color={c.primary} />
                <Text style={{ color: c.primary, fontWeight: '700' }}>{showArchived ? 'Back to chats' : `Archived (${archivedCount})`}</Text>
              </TouchableOpacity>
            ) : undefined
          }
          keyExtractor={(i) => String(i.id)}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name={error ? 'warning' : 'mail'} size={52} color={c.textMuted} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>{error ? 'Could not load messages' : 'Welcome to your inbox!'}</Text>
              <Text style={{ color: c.textSecondary, textAlign: 'center' }}>
                {error ? 'Check your connection and pull down to retry.' : 'Drop a line, share posts and more with private conversations.'}
              </Text>
              {!error ? (
                <TouchableOpacity style={[styles.cta, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('ContactScreen')}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Write a message</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <ChatItem item={item} draft={drafts[String(item.id)]} onPress={() => navigation.navigate('Chat', { conversationId: item.id, unread: Number(item.unread_count) || 0 })} />}
        />
      )}

      <TouchableOpacity style={[styles.fab, { backgroundColor: c.primary }]} onPress={() => setMenu(true)} activeOpacity={0.85}>
        <Icon name="mail" size={24} color="#FFFFFF" strokeWidth={2} />
      </TouchableOpacity>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={() => setMenu(false)} />
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          <View style={[styles.grab, { backgroundColor: c.border }]} />
          {[
            { icon: 'userPlus' as const, label: 'New message', to: 'ContactScreen' },
            { icon: 'users' as const, label: 'New group', to: 'GroupChat' },
          ].map((m) => (
            <TouchableOpacity key={m.to} style={styles.menuRow} onPress={() => go(m.to)} activeOpacity={0.7}>
              <Icon name={m.icon} size={22} color={c.text} />
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  cta: { marginTop: 10, paddingHorizontal: 24, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 18, bottom: 20, width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  backdrop: { flex: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 30, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
});
