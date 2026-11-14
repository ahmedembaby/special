import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppColors } from '../theme/useAppColors';
import { resolveUrl } from '../config';
import * as social from '../services/social';
import { onSocket } from '../services/socket';
import { StoryViewer } from './StoryViewer';
import { CachedImage } from './CachedImage';

/** Horizontal row of stories at the top of the feed (first bubble = add / view my story). */
export const StoriesBar = ({ meId, meAvatar, meName }: { meId: string; meAvatar?: string | null; meName?: string }) => {
  const { c } = useAppColors();
  const [groups, setGroups] = useState<social.StoryGroup[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => { social.getStoryFeed().then(setGroups); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => onSocket('story_viewed', () => { /* viewers are fetched on demand */ }), []);

  const addStory = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow access to your photos to share a story.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 30 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      await social.publishStory({ uri: a.uri, type: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg'), name: a.fileName || (a.type === 'video' ? 'story.mp4' : 'story.jpg') });
      load();
    } catch {
      Alert.alert('Error', 'Could not publish your story');
    } finally {
      setUploading(false);
    }
  };

  const myIdx = groups.findIndex((g) => g.user.id === meId);
  const mine = myIdx >= 0 ? groups[myIdx] : null;
  const others = groups.map((g, idx) => ({ g, idx })).filter(({ g }) => g.user.id !== meId);

  const bubble = (uri: string | null | undefined, name: string, ring: string | null, onPress: () => void, plus = false, key?: string) => (
    <TouchableOpacity key={key} style={styles.item} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.ring, { borderColor: ring || 'transparent' }]}>
        {resolveUrl(uri) ? (
          <CachedImage source={{ uri: resolveUrl(uri) || undefined }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 20 }}>{(name || 'U').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {plus ? <View style={[styles.plus, { backgroundColor: c.primary, borderColor: c.background }]}><Text style={styles.plusText}>+</Text></View> : null}
      </View>
      <Text style={{ color: c.text, fontSize: 12, maxWidth: 66 }} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {uploading ? <View style={styles.item}><ActivityIndicator color={c.primary} style={{ width: 64, height: 64 }} /></View> : null}
        {bubble(meAvatar, 'Your story', mine ? (mine.all_seen ? c.border : c.primary) : null, () => (mine ? setOpen(myIdx) : addStory()), !mine, 'me')}
        {mine ? bubble(null, 'Add', null, addStory, true, 'add') : null}
        {others.map(({ g, idx }) => bubble(g.user.avatar, g.user.name, g.all_seen ? c.border : c.primary, () => setOpen(idx), false, g.user.id))}
      </ScrollView>
      {open !== null ? (
        <StoryViewer groups={groups} startGroup={open} meId={meId} onClose={() => { setOpen(null); load(); }} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  item: { alignItems: 'center', gap: 4 },
  ring: { width: 70, height: 70, borderRadius: 24, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 19 },
  plus: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#fff', fontWeight: '800', fontSize: 15, lineHeight: 17 },
});
