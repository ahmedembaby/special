import { useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { useMe } from '../hooks/useMe';
import * as social from '../services/social';
import { ScreenHeader } from '../components/ScreenHeader';
import { PostCard } from '../components/PostCard';

export default function HashtagScreen() {
  const nav = useNavigation() as any;
  const route = useRoute() as any;
  const { c } = useAppColors();
  const me = useMe();
  const tag: string = String(route.params?.tag || '');
  const saved = !!route.params?.bookmarks;
  const [posts, setPosts] = useState<social.Post[] | null>(null);

  useEffect(() => { (saved ? social.getBookmarks() : social.getHashtagPosts(tag)).then(setPosts).catch(() => setPosts([])); }, [tag, saved]);
  const open = (id: string) => nav.navigate('Main', { screen: 'Home', params: { screen: 'PostDetail', params: { postId: id } } });

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader title={saved ? 'Saved posts' : `#${tag}`} onBack={() => nav.goBack()} />
      {posts === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 40 }}>{saved ? 'No saved posts yet.' : `No posts with #${tag} yet.`}</Text>}
          renderItem={({ item }) => (
            <PostCard post={item} meId={me.id} onLike={(id) => social.toggleLike(me, id)} onDelete={() => {}} onComment={(p) => open(p.id)} onPress={(p) => open(p.id)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
