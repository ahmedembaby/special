import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchBar } from '../components/SearchBar';
import { Avatar } from '../components/Avatar';
import { getChatName } from '../components/ChatItem';
import * as api from '../services/api';

type Row = { key: string; kind: 'chat' | 'msg'; conversationId: string | number; title: string; avatar?: string | null; text?: string; at?: string };

const highlight = (text: string, q: string, color: string) => {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <Text>{text}</Text>;
  return <Text>{text.slice(0, i)}<Text style={{ color, fontWeight: '800' }}>{text.slice(i, i + q.length)}</Text>{text.slice(i + q.length)}</Text>;
};

/** Search chats by name and plain-text messages across every conversation. (End-to-end encrypted text is only on your device.) */
export default function GlobalSearchScreen() {
  const nav = useNavigation() as any;
  const route = useRoute() as any;
  const { c } = useAppColors();
  const [q, setQ] = useState<string>(route.params?.q || '');
  const [chats, setChats] = useState<api.Conversation[]>([]);
  const [hits, setHits] = useState<api.SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.conversations.list().then((r) => setChats(r.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return undefined; }
    setLoading(true);
    const t = setTimeout(() => {
      api.messages.searchAll(term).then((r) => setHits(r.data.results || [])).catch(() => setHits([])).finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const rows = useMemo<Row[]>(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const chatRows: Row[] = chats
      .filter((cv) => getChatName(cv).toLowerCase().includes(term))
      .map((cv) => ({ key: `c${cv.id}`, kind: 'chat', conversationId: cv.id, title: getChatName(cv), avatar: cv.type === 'group' ? cv.avatar : cv.participants?.[0]?.avatar }));
    const msgRows: Row[] = hits.map((h) => ({ key: `m${h.id}`, kind: 'msg', conversationId: h.conversation_id, title: h.conversation_name || h.sender_name, avatar: h.conversation_avatar, text: h.content, at: h.created_at }));
    return [...chatRows, ...msgRows];
  }, [q, chats, hits]);

  const term = q.trim();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Search" onBack={() => nav.goBack()} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Chats and messages" />
      </View>
      {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 20 }} /> : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={!loading ? <Text style={[styles.empty, { color: c.textSecondary }]}>{term.length < 2 ? 'Type at least 2 letters.' : 'Nothing found.'}</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.8} style={[styles.row, { backgroundColor: c.card, shadowColor: c.shadow }]}
            onPress={() => nav.navigate('Main', { screen: 'Messages', params: { screen: 'Chat', params: { conversationId: item.conversationId } } })}>
            <Avatar source={item.avatar || undefined} name={item.title} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{item.title}</Text>
              {item.kind === 'msg' ? (
                <Text style={{ color: c.textSecondary, fontSize: 14, marginTop: 2 }} numberOfLines={2}>{highlight(item.text || '', term, c.primary)}</Text>
              ) : <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>Chat</Text>}
            </View>
            {item.at ? <Text style={{ color: c.textMuted, fontSize: 12 }}>{new Date(item.at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</Text> : null}
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginTop: 10, padding: 12, borderRadius: 18, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});
