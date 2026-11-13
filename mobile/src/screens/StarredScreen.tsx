import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { ScreenHeader } from '../components/ScreenHeader';
import * as api from '../services/api';

const label = (m: api.StarredMessage) =>
  m.type === 'image' ? '📷 Photo' : m.type === 'voice' ? `🎤 Voice message ${m.voice_duration || ''}` : m.type === 'file' ? '📎 File' : m.type === 'poll' ? `📊 ${m.content}`
  : m.content.startsWith('e2ee:') ? '🔒 Encrypted message (open the chat to read it)' : m.content;

/** Messages you starred, newest first. Tap one to open its chat; long-press to remove the star. */
export default function StarredScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const [items, setItems] = useState<api.StarredMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    api.messages.starred().then((r) => setItems(r.data.messages || [])).catch(() => {}).finally(() => setLoading(false));
  }, []));

  const unstar = (m: api.StarredMessage) =>
    Alert.alert('Remove star', 'Remove this message from your starred messages?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => api.messages.unstar(m.id).then(() => setItems((p) => p.filter((x) => x.id !== m.id))).catch(() => Alert.alert('Error', 'Could not remove the star')) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Starred messages" onBack={() => nav.goBack()} />
      {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: c.textSecondary }]}>No starred messages yet.{'\n'}Long-press a message in a chat and choose ⭐ Star.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onLongPress={() => unstar(item)}
              onPress={() => nav.navigate('Main', { screen: 'Messages', params: { screen: 'Chat', params: { conversationId: item.conversation_id } } })}
              style={[styles.card, { backgroundColor: c.card, shadowColor: c.shadow }]}>
              <View style={styles.head}>
                <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{item.sender_name}{item.conversation_name ? `  ›  ${item.conversation_name}` : ''}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>{new Date(item.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <Text style={{ color: c.text, fontSize: 15, marginTop: 6 }} numberOfLines={4}>{label(item)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 10, padding: 14, borderRadius: 18, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15, lineHeight: 22, paddingHorizontal: 30 },
});
