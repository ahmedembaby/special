import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import * as api from '../services/api';
import * as social from '../services/social';
import { useMe } from '../hooks/useMe';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchBar } from '../components/SearchBar';
import { TopTabs } from '../components/Tabs';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';

export default function SearchScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const me = useMe();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(0);
  const [people, setPeople] = useState<social.SocialUser[]>([]);
  const [posts, setPosts] = useState<social.Post[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [tags, setTags] = useState<Array<{ tag: string; posts: number }>>([]);

  useEffect(() => {
    social.getFollowing().then(setFollowing);
    social.getTrendingTags().then(setTags);
    api.users.list().then((r) => {
      const real: social.SocialUser[] = (r.data || [])
        .filter((u) => String(u.id) !== me.id)
        .map((u) => ({ id: String(u.id), name: u.name, username: u.username || social.makeUsername(u.name, u.id), avatar: u.avatar, bio: u.bio || undefined }));
      setPeople(real);
    }).catch(() => {});
  }, [me.id]);

  useEffect(() => {
    let alive = true;
    social.searchPosts(q).then((r) => alive && setPosts(r)).catch(() => alive && setPosts([]));
    return () => { alive = false; };
  }, [q]);

  const follow = async (id: string) => setFollowing(await social.toggleFollow(id));
  const needle = q.trim().toLowerCase();
  const matches = people.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.username.includes(needle));

  const Person = ({ p }: { p: social.SocialUser }) => {
    const on = following.includes(p.id);
    return (
      <View style={[styles.person, { borderBottomColor: c.border }]}>
        <Avatar source={p.avatar} name={p.name} size={46} userId={p.id} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{p.name}</Text>
            {p.verified ? <Icon name="verified" size={14} color={c.primary} strokeWidth={1.2} /> : null}
          </View>
          <Text style={{ color: c.textSecondary }} numberOfLines={1}>@{p.username}</Text>
          {p.bio ? <Text style={{ color: c.text, marginTop: 2 }} numberOfLines={1}>{p.bio}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => follow(p.id)}
          style={[styles.followBtn, on ? { borderColor: c.border, borderWidth: 1 } : { backgroundColor: c.text }]}
          activeOpacity={0.8}
        >
          <Text style={{ color: on ? c.text : c.background, fontWeight: '800', fontSize: 14 }}>{on ? 'Following' : 'Follow'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader title="Search" avatarUri={me.avatar} avatarName={me.name} onAvatarPress={() => nav.navigate('Profile')}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Search" />
        </View>
        {needle ? <TopTabs tabs={['Posts', 'People']} active={tab} onChange={setTab} /> : null}
      </ScreenHeader>

      {!needle ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={[styles.h, { color: c.text }]}>Trends for you</Text>
          {tags.length === 0 ? <Text style={{ color: c.textSecondary, paddingHorizontal: 16 }}>No trending hashtags yet. Add #tags to your posts.</Text> : null}
          {tags.map((t) => (
            <TouchableOpacity key={t.tag} style={styles.trend} activeOpacity={0.7} onPress={() => nav.navigate('Hashtag', { tag: t.tag })}>
              <Text style={{ color: c.textSecondary, fontSize: 13 }}>Trending this week</Text>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, marginVertical: 1 }}>#{t.tag}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 13 }}>{t.posts} posts</Text>
            </TouchableOpacity>
          ))}
          <Text style={[styles.h, { color: c.text, marginTop: 8 }]}>Who to follow</Text>
          {people.slice(0, 6).map((p) => <Person key={p.id} p={p} />)}
        </ScrollView>
      ) : tab === 0 ? (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[styles.none, { color: c.textSecondary }]}>No posts found for “{q}”</Text>}
          renderItem={({ item }) => (
            <PostCard post={item} meId={me.id} onLike={(id) => social.toggleLike(me, id)} onDelete={() => {}}
              onComment={(p) => nav.navigate('Home', { screen: 'PostDetail', params: { postId: p.id } })}
              onPress={(p) => nav.navigate('Home', { screen: 'PostDetail', params: { postId: p.id } })} />
          )}
        />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[styles.none, { color: c.textSecondary }]}>No people found for “{q}”</Text>}
          renderItem={({ item }) => <Person p={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  h: { fontSize: 20, fontWeight: '800', paddingHorizontal: 16, paddingVertical: 12 },
  trend: { paddingHorizontal: 16, paddingVertical: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  followBtn: { paddingHorizontal: 16, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  none: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});
