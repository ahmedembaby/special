import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SectionList, ActivityIndicator, RefreshControl, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import * as social from '../services/social';
import { ScreenHeader } from '../components/ScreenHeader';
import { NotificationItem } from '../components/NotificationItem';
import { Icon } from '../components/Icon';
import { useMe } from '../hooks/useMe';
import { onSocket } from '../services/socket';
import { useUnreadCounts } from '../context/UnreadCountsContext';
import { useI18n } from '../i18n';

type Category = 'all' | 'messages' | 'interactions' | 'follows' | 'groups' | 'announcements';

const CATEGORY_OF = (type: social.AppNotification['type']): Exclude<Category, 'all'> => {
  if (type === 'message' || type === 'reply') return 'messages';
  if (type === 'like' || type === 'comment' || type === 'mention') return 'interactions';
  if (type === 'follow' || type === 'follow_request' || type === 'follow_accepted') return 'follows';
  if (type === 'group_invite' || type === 'group_request' || type === 'group_approved') return 'groups';
  return 'announcements';
};

const dayKey = (iso: string): 'Today' | 'Yesterday' | 'This week' | 'Earlier' => {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(new Date(iso))) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'This week';
  return 'Earlier';
};

export default function NotificationsScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const { t } = useI18n();
  const me = useMe();
  const { refresh: refreshUnreadCounts } = useUnreadCounts();
  const [items, setItems] = useState<social.AppNotification[]>([]);
  // Ids that were unread when loaded: they stay highlighted while the screen is open even though the server marks them read
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<Category>('all');

  const load = useCallback(async () => {
    try {
      const list = await social.listNotifications();
      setItems(list);
      setUnreadIds(new Set(list.filter((n) => !n.read).map((n) => n.id)));
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
    setUnreadIds((prev) => new Set(prev).add(n.id));
    social.markNotificationsRead().then(() => refreshUnreadCounts()).catch(() => {});
  }), [refreshUnreadCounts]);

  const counts = useMemo(() => {
    const out: Record<Category, number> = { all: 0, messages: 0, interactions: 0, follows: 0, groups: 0, announcements: 0 };
    for (const n of items) {
      if (!unreadIds.has(n.id)) continue;
      out.all += 1;
      out[CATEGORY_OF(n.type)] += 1;
    }
    return out;
  }, [items, unreadIds]);

  const sections = useMemo(() => {
    const visible = category === 'all' ? items : items.filter((n) => CATEGORY_OF(n.type) === category);
    const order = ['Today', 'Yesterday', 'This week', 'Earlier'] as const;
    return order
      .map((key) => ({ key, data: visible.filter((n) => dayKey(n.createdAt) === key) }))
      .filter((s) => s.data.length);
  }, [items, category]);

  const categories: Array<[Category, string]> = [
    ['all', t('All')], ['messages', t('Messages')], ['interactions', t('Interactions')],
    ['follows', t('Follows')], ['groups', t('Groups')], ['announcements', t('Announcements')],
  ];

  const remove = (id: string) => {
    setItems((p) => p.filter((n) => n.id !== id));
    social.deleteNotification(id).catch(() => load());
  };

  const open = (item: social.AppNotification) => {
    if (item.type === 'follow' || item.type === 'follow_request' || item.type === 'follow_accepted') nav.navigate('UserProfile', { userId: item.from.id });
    else if (item.post) nav.navigate('Home', { screen: 'PostDetail', params: { postId: item.post.id } });
    else if (item.group) nav.navigate('Groups');
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader title={t('Notifications')} avatarUri={me.avatar} avatarName={me.name} onAvatarPress={() => nav.navigate('Profile')} rightIcon="settings" onRightPress={() => nav.navigate('Profile', { screen: 'Settings' })} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      ) : (
        <View style={{ flex: 1 }}>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categories.map(([key, label]) => {
                const active = category === key;
                const n = counts[key];
                return (
                  <TouchableOpacity key={key} onPress={() => setCategory(key)} activeOpacity={0.8} style={[styles.chip, { backgroundColor: active ? c.primary : c.card, borderColor: active ? c.primary : c.border }]}>
                    <Text style={{ color: active ? '#FFFFFF' : c.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
                    {n > 0 ? (
                      <View style={[styles.count, { backgroundColor: active ? '#FFFFFF' : c.primary }]}>
                        <Text style={{ color: active ? c.primary : '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{n > 99 ? '99+' : n}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <SectionList
            sections={sections}
            keyExtractor={(n) => n.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} colors={[c.primary]} />}
            renderSectionHeader={({ section }) => (
              <Text style={[styles.section, { color: c.textSecondary, backgroundColor: c.background }]}>{t(section.key)}</Text>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: c.primaryLight }]}>
                  <Icon name="bell" size={34} color={c.primary} />
                </View>
                <Text style={[styles.title, { color: c.text }]}>{t('No notifications yet')}</Text>
                <Text style={{ color: c.textSecondary, textAlign: 'center', lineHeight: 21 }}>{t('App updates, announcements, reactions, replies and group invitations will show up here.')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <NotificationItem item={item} unread={unreadIds.has(item.id)} onDelete={remove} onPress={() => open(item)} />
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chips: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1 },
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 42, gap: 13 },
  emptyIcon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
});
