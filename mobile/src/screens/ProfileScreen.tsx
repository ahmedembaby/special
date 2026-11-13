import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAppColors } from '../theme/useAppColors';
import { useFeed } from '../hooks/useFeed';
import { getFollowing } from '../services/social';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { TopTabs } from '../components/Tabs';
import { PostCard } from '../components/PostCard';
import { ImageViewer } from '../components/ImageViewer';
import { resolveUrl } from '../config';

const BANNER = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=60';

export default function ProfileScreen() {
  const [avatarViewer, setAvatarViewer] = useState(false);
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { me, posts, refreshing, refresh, like, remove } = useFeed();
  const [tab, setTab] = useState(0);
  const [following, setFollowing] = useState(0);

  useEffect(() => nav.addListener('focus', () => { getFollowing().then((f) => setFollowing(f.length)); }), [nav]);

  const mine = useMemo(() => posts.filter((p) => p.user.id === me.id), [posts, me.id]);
  const data = tab === 0 ? mine : tab === 1 ? mine.filter((p) => !!p.image) : posts.filter((p) => p.likes.includes(me.id));
  const openPost = (id: string) => nav.navigate('Home', { screen: 'PostDetail', params: { postId: id } });

  const header = (
    <View>
      <View>
        <Image source={{ uri: BANNER }} style={styles.banner} />
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <TouchableOpacity style={styles.circle} onPress={() => nav.getParent()?.navigate('Home')}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.circle} onPress={() => nav.navigate('Settings')}>
            <Icon name="settings" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarRing, { borderColor: c.background, backgroundColor: c.background }]}>
            <Avatar source={me.avatar} name={me.name} size={80} onPress={me.avatar ? () => setAvatarViewer(true) : undefined} />
            {avatarViewer ? <ImageViewer uri={resolveUrl(me.avatar)} onClose={() => setAvatarViewer(false)} /> : null}
          </View>
          <TouchableOpacity style={[styles.editBtn, { borderColor: c.inputBorder }]} onPress={() => nav.navigate('ProfileEdit')} activeOpacity={0.7}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 14 }}>Edit profile</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.name, { color: c.text }]}>{me.name}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 15 }}>@{me.username}</Text>
        {(user as any)?.bio ? <Text style={{ color: c.text, fontSize: 15, marginTop: 10, lineHeight: 21 }}>{(user as any).bio}</Text> : null}
        <View style={styles.metaRow}>
          {user?.phone ? (
            <View style={styles.meta}><Icon name="phone" size={15} color={c.textSecondary} /><Text style={{ color: c.textSecondary }}>{user.phone}</Text></View>
          ) : null}
          {user?.email ? (
            <View style={styles.meta}><Icon name="mail" size={15} color={c.textSecondary} /><Text style={{ color: c.textSecondary }}>{user.email}</Text></View>
          ) : null}
        </View>
        <View style={styles.counts}>
          <Text style={{ color: c.text }}><Text style={{ fontWeight: '800' }}>{following}</Text><Text style={{ color: c.textSecondary }}> Following</Text></Text>
          <Text style={{ color: c.text }}><Text style={{ fontWeight: '800' }}>{mine.length}</Text><Text style={{ color: c.textSecondary }}> Posts</Text></Text>
        </View>
      </View>
      <TopTabs tabs={['Posts', 'Media', 'Likes']} active={tab} onChange={setTab} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <FlatList
        data={data}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
        ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 40 }}>Nothing to show here yet.</Text>}
        renderItem={({ item }) => (
          <PostCard post={item} meId={me.id} onLike={like} onDelete={remove} onComment={(p) => openPost(p.id)} onPress={(p) => openPost(p.id)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: { width: '100%', height: 130, backgroundColor: '#333' },
  topBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  circle: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  info: { paddingHorizontal: 16, paddingBottom: 14 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -40, marginBottom: 8 },
  avatarRing: { borderWidth: 4, borderRadius: 48 },
  editBtn: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, height: 36, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  counts: { flexDirection: 'row', gap: 18, marginTop: 10 },
});
