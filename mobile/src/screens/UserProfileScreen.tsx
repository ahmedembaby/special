import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../services/api';
import * as social from '../services/social';
import { useAuth } from '../context/AuthContext';
import { useAppColors } from '../theme/useAppColors';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { PostCard } from '../components/PostCard';
import { ImageViewer } from '../components/ImageViewer';
import { resolveUrl } from '../config';
import { useMe } from '../hooks/useMe';
import { useCall } from '../context/CallContext';
import { StoryViewer } from '../components/StoryViewer';
import { OptionSheet } from '../components/OptionSheet';
import { ReportSheet, ReportTarget } from '../components/ReportSheet';
import * as apiSvc from '../services/api';

const BANNER = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=60';
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

/** Another user's profile: info, follow / message buttons and their posts. */
export default function UserProfileScreen() {
  const nav = useNavigation() as any;
  const route = useRoute() as any;
  const { c } = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const me = useMe();
  const userId: string = String(route.params?.userId || '');

  const [profile, setProfile] = useState<social.UserProfile | null>(null);
  const [posts, setPosts] = useState<social.Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avatarViewer, setAvatarViewer] = useState(false);
  const [stories, setStories] = useState<social.Story[]>([]);
  const [storyOpen, setStoryOpen] = useState(false);
  const call = useCall();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState<ReportTarget>(null);
  const toggleBlock = async () => {
    if (!profile) return;
    try {
      const r = await apiSvc.safety.block(profile.id);
      if (r.data.blocked) { Alert.alert('Blocked', `${profile.name} can no longer see your posts or message you.`); nav.goBack(); }
      else load();
    } catch { Alert.alert('Error', 'Could not update block'); }
  };

  const load = useCallback(async () => {
    try {
      const p = await social.getUserProfile(userId);
      setProfile(p);
      if (p.can_view !== false) {
        setPosts(await social.listPosts(p.username));
        social.getUserStories(p.id).then(setStories).catch(() => setStories([]));
      } else {
        setPosts([]);
        setStories([]);
      }
    } catch (e: any) {
      if (e?.response?.status === 404) setMissing(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // your own profile lives in the Profile tab
  useEffect(() => {
    if (user && String(user.id) === userId) {
      nav.goBack();
      nav.navigate('Main', { screen: 'Profile' });
      return;
    }
    load();
  }, [userId]);

  const toggleFollow = async () => {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const res = await social.followToggle(profile.id);
      const wasFollowing = profile.is_following;
      setProfile({
        ...profile,
        is_following: res.following,
        requested: res.requested,
        can_view: !profile.is_private || res.following,
        followers_count: profile.followers_count + (res.following === wasFollowing ? 0 : res.following ? 1 : -1),
      });
      if (res.following) load();
    } catch {
      Alert.alert('Error', 'Could not update follow.');
    } finally {
      setBusy(false);
    }
  };

  const message = async () => {
    if (!profile) return;
    try {
      const res = await api.conversations.create({ participantIds: [profile.id], type: 'direct', name: '' });
      nav.navigate('Main', { screen: 'Messages', params: { screen: 'Chat', params: { conversationId: res.data.id } } });
    } catch {
      Alert.alert('Error', 'Could not open the chat.');
    }
  };

  const openPost = (id: string) => nav.navigate('Main', { screen: 'Home', params: { screen: 'PostDetail', params: { postId: id } } });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={c.primary} />;

  const back = (
    <TouchableOpacity style={[styles.circle, { top: insets.top + 8 }]} onPress={() => nav.goBack()}>
      <Icon name="arrowLeft" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  );

  if (missing || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, justifyContent: 'center' }]}>
        {back}
        <Text style={{ color: c.textSecondary, textAlign: 'center' }}>This account is not available.</Text>
      </View>
    );
  }

  const header = (
    <View>
      <Image source={{ uri: BANNER }} style={styles.banner} />
      {back}
      {profile.id !== String(user?.id) ? (
        <TouchableOpacity style={[styles.circle, { top: insets.top + 8, left: undefined, right: 12 }]} onPress={() => setMenu(true)}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>⋯</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.info}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarRing, { borderColor: c.background, backgroundColor: c.background }]}>
            <View style={stories.length ? { borderWidth: 3, borderColor: stories.every((x) => x.seen) ? c.border : c.primary, borderRadius: 46, padding: 2 } : undefined}>
              <Avatar source={profile.avatar} name={profile.name} size={80} status={profile.status} onPress={stories.length ? () => setStoryOpen(true) : profile.avatar ? () => setAvatarViewer(true) : undefined} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.outBtn, { borderColor: c.inputBorder }]} onPress={message} activeOpacity={0.7}>
              <Icon name="messageCircle" size={18} color={c.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.outBtn, { borderColor: c.inputBorder }]} onPress={() => call.start({ id: profile.id, name: profile.name, avatar: profile.avatar }, 'audio')} activeOpacity={0.7}>
              <Icon name="phone" size={18} color={c.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleFollow}
              disabled={busy}
              activeOpacity={0.8}
              style={[styles.followBtn, profile.is_following || profile.requested ? { borderColor: c.inputBorder, borderWidth: 1 } : { backgroundColor: c.text }]}
            >
              <Text style={{ color: profile.is_following || profile.requested ? c.text : c.background, fontWeight: '800', fontSize: 14 }}>
                {profile.is_following ? 'Following' : profile.requested ? 'Requested' : profile.follows_me ? 'Follow back' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.name, { color: c.text }]}>{profile.name}{profile.is_private ? '  🔒' : ''}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 15 }}>
          @{profile.username}
          {profile.follows_me ? <Text style={{ backgroundColor: c.surface }}>  Follows you  </Text> : null}
        </Text>
        {profile.bio ? <Text style={{ color: c.text, fontSize: 15, marginTop: 10, lineHeight: 21 }}>{profile.bio}</Text> : null}
        <View style={styles.counts}>
          <Text style={{ color: c.text }}><Text style={{ fontWeight: '800' }}>{compact(profile.following_count)}</Text><Text style={{ color: c.textSecondary }}> Following</Text></Text>
          <Text style={{ color: c.text }}><Text style={{ fontWeight: '800' }}>{compact(profile.followers_count)}</Text><Text style={{ color: c.textSecondary }}> Followers</Text></Text>
          <Text style={{ color: c.text }}><Text style={{ fontWeight: '800' }}>{compact(profile.posts_count)}</Text><Text style={{ color: c.textSecondary }}> Posts</Text></Text>
        </View>
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
      <OptionSheet
        visible={menu}
        options={[
          { label: profile.blocked_by_me ? 'Unblock' : 'Block', danger: !profile.blocked_by_me, onPress: toggleBlock },
          { label: 'Report', danger: true, onPress: () => setReport({ type: 'user', id: profile.id }) },
        ]}
        onClose={() => setMenu(false)}
      />
      <ReportSheet target={report} onClose={() => setReport(null)} />
      {storyOpen && stories.length ? (
        <StoryViewer
          groups={[{ user: { id: profile.id, name: profile.name, username: profile.username, avatar: profile.avatar }, stories, all_seen: stories.every((x) => x.seen) }]}
          startGroup={0}
          meId={String(user?.id)}
          onClose={() => { setStoryOpen(false); load(); }}
        />
      ) : null}
      {avatarViewer ? <ImageViewer uri={resolveUrl(profile.avatar)} onClose={() => setAvatarViewer(false)} /> : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} colors={[c.primary]} />}
        ListEmptyComponent={
          <Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 30 }}>
            {profile.can_view === false ? '🔒 This account is private.\nFollow them to see their posts and stories.' : 'No posts yet.'}
          </Text>
        }
        renderItem={({ item }) => (
          <PostCard post={item} meId={me.id} onLike={() => {}} onDelete={() => {}} onComment={(p) => openPost(p.id)} onPress={(p) => openPost(p.id)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: { width: '100%', height: 130, backgroundColor: '#333' },
  circle: { position: 'absolute', left: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  info: { paddingHorizontal: 16, paddingBottom: 14 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -40, marginBottom: 8 },
  avatarRing: { borderWidth: 4, borderRadius: 48 },
  outBtn: { width: 36, height: 36, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  followBtn: { borderRadius: 18, paddingHorizontal: 18, height: 36, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '800' },
  counts: { flexDirection: 'row', gap: 18, marginTop: 10 },
});
