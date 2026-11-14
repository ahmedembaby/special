import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import * as social from '../services/social';
import { ScreenHeader } from '../components/ScreenHeader';
import { NotificationItem } from '../components/NotificationItem';
import { Icon } from '../components/Icon';
import { useMe } from '../hooks/useMe';
import { onSocket } from '../services/socket';
import { useUnreadCounts } from '../context/UnreadCountsContext';

export default function NotificationsScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const me = useMe();
  const { refresh: refreshUnreadCounts } = useUnreadCounts();
  const [items, setItems] = useState<social.AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<'all' | 'messages' | 'interactions' | 'follows' | 'groups' | 'announcements'>('all');

  const load = useCallback(async () => {
    try {
      setItems(await social.listNotifications());
      await social.markNotificationsRead().catch(() => {});
      refreshUnreadCounts();
    } catch {
      // keep the current list
    } finally { setLoading(false); setRefreshing(false); }
  }, [refreshUnreadCounts]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // New notification pushed by the server while the screen is open
  useEffect(() => onSocket('notification', (n: social.AppNotification) => {
    setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
  }), []);

  const visibleItems = items.filter((item) => {
    if (category === 'all') return true;
    if (category === 'messages') return item.type === 'message' || item.type === 'reply';
    if (category === 'interactions') return item.type === 'like' || item.type === 'comment' || item.type === 'mention';
    if (category === 'follows') return item.type === 'follow' || item.type === 'follow_request' || item.type === 'follow_accepted';
    if (category === 'groups') return item.type === 'group_invite' || item.type === 'group_request' || item.type === 'group_approved';
    return item.type === 'broadcast' || item.type === 'digest';
  });
  const categories = [
    ['all', 'All'], ['messages', 'Messages'], ['interactions', 'Interactions'],
    ['follows', 'Follows'], ['groups', 'Groups'], ['announcements', 'Announcements'],
  ] as const;

  const remove = (id: string) => {
    setItems((p) => p.filter((n) => n.id !== id));
    social.deleteNotification(id).catch(() => load());
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader title="Notifications" avatarUri={me.avatar} avatarName={me.name} onAvatarPress={() => nav.navigate('Profile')} rightIcon="settings" onRightPress={() => nav.navigate('Profile', { screen: 'Settings' })} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      ) : (
        <View style={{ flex: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
          {categories.map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => setCategory(key)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: category === key ? c.primary : c.card, borderWidth: 1, borderColor: category === key ? c.primary : c.border }}>
              <Text style={{ color: category === key ? '#FFFFFF' : c.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <FlatList
          data={visibleItems}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} colors={[c.primary]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="bell" size={56} color={c.textMuted} />
              <Text style={[styles.title, { color: c.text }]}>No notifications yet</Text>
              <Text style={{ color: c.textSecondary, textAlign: 'center' }}>App updates, announcements, reactions, replies and group invitations will show up here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              onDelete={remove}
              onPress={() => {
                if (item.type === 'follow' || item.type === 'follow_request' || item.type === 'follow_accepted') nav.navigate('UserProfile', { userId: item.from.id });
                else if (item.group) nav.navigate('Groups');
                else if (item.post) nav.navigate('Home', { screen: 'PostDetail', params: { postId: item.post.id } });
              }}
            />
          )}
        />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 92, paddingHorizontal: 42, gap: 13 },
  title: { fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
});
