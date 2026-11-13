import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import * as social from '../services/social';
import { ScreenHeader } from '../components/ScreenHeader';
import { NotificationItem } from '../components/NotificationItem';
import { Icon } from '../components/Icon';
import { useMe } from '../hooks/useMe';
import { onSocket } from '../services/socket';

export default function NotificationsScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const me = useMe();
  const [items, setItems] = useState<social.AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await social.listNotifications());
      social.markNotificationsRead().catch(() => {});
    } catch {
      // keep the current list
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // New notification pushed by the server while the screen is open
  useEffect(() => onSocket('notification', (n: social.AppNotification) => {
    setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
  }), []);

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
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} colors={[c.primary]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="bell" size={56} color={c.textMuted} />
              <Text style={[styles.title, { color: c.text }]}>No notifications yet</Text>
              <Text style={{ color: c.textSecondary, textAlign: 'center' }}>Reactions, replies, new followers and group invitations will show up here.</Text>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 10 },
  title: { fontSize: 22, fontWeight: '800' },
});
