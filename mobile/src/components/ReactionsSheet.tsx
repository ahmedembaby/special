import React, { useEffect, useState } from 'react';
import { Modal, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as social from '../services/social';
import { Avatar } from './Avatar';
import { useAppColors } from '../theme/useAppColors';

interface Props {
  kind: 'post' | 'comment';
  id: string | null;
  onClose: () => void;
}

/** Bottom sheet listing everyone who reacted, filterable by reaction; a tap opens the person's profile. */
export const ReactionsSheet = ({ kind, id, onClose }: Props) => {
  const { c } = useAppColors();
  const nav = useNavigation() as any;
  const [items, setItems] = useState<social.Reactor[] | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    setItems(null); setFilter(null); setFailed(false);
    social.getReactors(kind, id).then(setItems).catch(() => setFailed(true));
  }, [kind, id]);

  const counts = new Map<string, number>();
  (items || []).forEach((r) => counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1));
  const shown = (items || []).filter((r) => !filter || r.emoji === filter);

  const open = (userId: string) => {
    onClose();
    setTimeout(() => nav.navigate('UserProfile', { userId }), 150);
  };

  return (
    <Modal visible={!!id} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.background }]} onPress={() => {}}>
          <View style={[styles.grab, { backgroundColor: c.border }]} />
          <Text style={[styles.title, { color: c.text }]}>Reactions</Text>
          {counts.size > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
              {[[null, items?.length || 0] as [string | null, number], ...Array.from(counts.entries())].map(([e, n]) => (
                <TouchableOpacity key={e || 'all'} onPress={() => setFilter(e)} style={[styles.chip, { backgroundColor: filter === e ? c.primary : c.surface }]}>
                  <Text style={{ color: filter === e ? '#fff' : c.text, fontWeight: '700' }}>{e || 'All'} {n}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {failed ? (
            <Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 30 }}>Could not load reactions</Text>
          ) : items === null ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={c.primary} />
          ) : (
            <FlatList
              data={shown}
              keyExtractor={(r) => r.user.id}
              ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 30 }}>No reactions yet</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => open(item.user.id)} activeOpacity={0.7}>
                  <Avatar source={item.user.avatar} name={item.user.name} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{item.user.name}</Text>
                    <Text style={{ color: c.textSecondary }} numberOfLines={1}>@{item.user.username}</Text>
                  </View>
                  <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '70%', minHeight: 260, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 24 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 8 },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginVertical: 12 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
});
