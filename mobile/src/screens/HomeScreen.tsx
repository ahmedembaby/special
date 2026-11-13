import { useEffect, useMemo, useState } from 'react';
import { View, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet, Text, RefreshControl, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import { useFeed } from '../hooks/useFeed';
import { getFollowing } from '../services/social';
import { ScreenHeader } from '../components/ScreenHeader';
import { TopTabs } from '../components/Tabs';
import { PostCard } from '../components/PostCard';
import { PostComposer } from '../components/PostComposer';
import { Icon } from '../components/Icon';
import { StoriesBar } from '../components/StoriesBar';

export default function HomeScreen() {
  const nav = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const insets = useSafeAreaInsets();
  const { me, posts, loading, refreshing, refresh, like, remove, create } = useFeed();
  const [tab, setTab] = useState(0);
  const [following, setFollowing] = useState<string[]>([]);

  useEffect(() => nav.addListener('focus', () => { getFollowing().then(setFollowing); }), [nav]);

  const data = useMemo(
    () => (tab === 0 ? posts : posts.filter((p) => p.user.id === me.id || following.includes(p.user.id))),
    [tab, posts, following, me.id]
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader logo avatarUri={me.avatar} avatarName={me.name} onAvatarPress={() => nav.navigate('Profile')}>
        <TopTabs tabs={['For you', 'Following']} active={tab} onChange={setTab} />
      </ScreenHeader>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(p) => p.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
          ListHeaderComponent={<View><StoriesBar meId={String(me.id)} meAvatar={me.avatar} meName={me.name} /><PostComposer me={me} onPost={create} /></View>}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>{tab === 1 ? 'Nothing here yet' : 'No posts yet'}</Text>
              <Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 6 }}>
                {tab === 1 ? 'Follow people from the Search tab to see their posts here.' : 'Be the first to post something.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              meId={me.id}
              onLike={like}
              onDelete={remove}
              onComment={(p) => nav.navigate('PostDetail', { postId: p.id })}
              onPress={(p) => nav.navigate('PostDetail', { postId: p.id })}
            />
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: c.primary, bottom: 20 + (insets.bottom ? 0 : 0) }]}
        onPress={() => nav.navigate('Compose')}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={26} color="#FFFFFF" strokeWidth={2.4} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  fab: {
    position: 'absolute', right: 18, width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
});
