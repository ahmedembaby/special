import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { IconText } from '../components/IconText';
import type { IconName } from '../components/Icon';
import * as api from '../services/api';

const label = (m: api.StarredMessage): { icon: IconName | null; text: string } =>
  m.type === 'image' ? { icon: 'image', text: 'Photo' } : m.type === 'voice' ? { icon: 'mic', text: `Voice message ${m.voice_duration || ''}`.trim() } : m.type === 'file' ? { icon: 'file', text: 'File' } : m.type === 'poll' ? { icon: 'poll', text: m.content }
  : m.content.startsWith('e2ee:') ? { icon: 'lockFill', text: 'Encrypted message (open the chat to read it)' } : { icon: null, text: m.content };

/** Messages you starred, newest first. Tap one to open its chat; long-press to remove the star. */
export default function StarredScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const [items, setItems] = useState<api.StarredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useFocusEffect(useCallback(() => {
    setFailed(false);
    api.messages.starred().then((r) => setItems(r.data.messages || [])).catch(() => setFailed(true)).finally(() => setLoading(false));
  }, []));

  const unstar = (m: api.StarredMessage) =>
    Alert.alert('Remove star', 'Remove this message from your starred messages?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => api.messages.unstar(m.id).then(() => setItems((p) => p.filter((x) => x.id !== m.id))).catch(() => Alert.alert('Error', 'Could not remove the star')) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Starred messages" onBack={() => nav.goBack()} />
      {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 30 }} /> : failed && items.length === 0 ? (
        <EmptyState icon="star" title="Could not load starred messages" subtitle="Check your connection and try again." actionLabel="Try again" onAction={() => { setLoading(true); setFailed(false); api.messages.starred().then((r) => setItems(r.data.messages || [])).catch(() => setFailed(true)).finally(() => setLoading(false)); }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: c.textSecondary }]}>No starred messages yet.{'\n'}Long-press a message in a chat and choose Star.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onLongPress={() => unstar(item)}
              onPress={() => nav.navigate('Main', { screen: 'Messages', params: { screen: 'Chat', params: { conversationId: item.conversation_id } } })}
              style={[styles.card, { backgroundColor: c.card, shadowColor: c.shadow }]}>
              <View style={styles.head}>
                <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{item.sender_name}{item.conversation_name ? `  ›  ${item.conversation_name}` : ''}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>{new Date(item.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              {(() => { const l = label(item); return l.icon ? <IconText icon={l.icon} color={c.text} size={16} style={{ marginTop: 6 }} textStyle={{ fontSize: 15, flexShrink: 1 }} numberOfLines={4}>{l.text}</IconText> : <Text style={{ color: c.text, fontSize: 15, marginTop: 6 }} numberOfLines={4}>{l.text}</Text>; })()}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 18, marginTop: 12, padding: 17, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(110,120,150,0.18)' },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  empty: { textAlign: 'center', marginTop: 76, fontSize: 15, lineHeight: 24, paddingHorizontal: 34 },
});
