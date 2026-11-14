import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageCompressor, Video as VideoCompressor } from 'react-native-compressor';
import { useAppColors } from '../theme/useAppColors';
import { resolveUrl } from '../config';
import * as social from '../services/social';
import { onSocket } from '../services/socket';
import { StoryViewer } from './StoryViewer';
import { CachedImage } from './CachedImage';

type StoryAudience = 'everyone' | 'followers' | 'only_me';

export const StoriesBar = ({ meId, meAvatar, meName }: { meId: string; meAvatar?: string | null; meName?: string }) => {
  const { c } = useAppColors();
  const [groups, setGroups] = useState<social.StoryGroup[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [audience, setAudience] = useState<StoryAudience>('followers');

  const load = useCallback(() => { social.getStoryFeed().then(setGroups); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => onSocket('story_viewed', () => { /* viewer list is refreshed on demand */ }), []);

  const chooseMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow access to your photos to share a story.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.72, videoMaxDuration: 30 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const isVideo = a.type === 'video';
    const file = {
      uri: a.uri,
      type: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
      name: a.fileName || (isVideo ? 'story.mp4' : 'story.jpg'),
    };
    setUploading(true);
    try {
      try {
        if (isVideo) {
          file.uri = await VideoCompressor.compress(a.uri, { compressionMethod: 'auto', maxSize: 1280, minimumFileSizeForCompress: 2, preserveMetadata: false });
        } else {
          file.uri = await ImageCompressor.compress(a.uri, { compressionMethod: 'auto', maxWidth: 1600, maxHeight: 1600, quality: 0.8 });
          file.type = 'image/jpeg';
          if (!/\\.jpe?g$/i.test(file.name)) file.name = file.name.replace(/\\.[^.]+$/, '') + '.jpg';
        }
      } catch {
        Alert.alert('Compression skipped', 'The original story media will be uploaded because compression was unavailable on this device.');
      }
      await social.publishStory(file, undefined, audience);
      setComposerOpen(false);
      load();
    } catch {
      Alert.alert('Error', 'Could not publish your story');
    } finally {
      setUploading(false);
    }
  };

  const publishText = async () => {
    const text = storyText.trim();
    if (!text || uploading) return;
    setUploading(true);
    try {
      await social.publishTextStory(text, audience);
      setStoryText('');
      setComposerOpen(false);
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
        {resolveUrl(uri) ? <CachedImage source={{ uri: resolveUrl(uri) || undefined }} style={styles.avatar} /> : (
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
        {bubble(meAvatar, 'Your story', mine ? (mine.all_seen ? c.border : c.primary) : null, () => (mine ? setOpen(myIdx) : setComposerOpen(true)), !mine, 'me')}
        {mine ? bubble(null, 'Add', null, () => setComposerOpen(true), true, 'add') : null}
        {others.map(({ g, idx }) => bubble(g.user.avatar, g.user.name, g.all_seen ? c.border : c.primary, () => setOpen(idx), false, g.user.id))}
      </ScrollView>
      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.composer, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.composerHead}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Create a story</Text>
              <TouchableOpacity onPress={() => setComposerOpen(false)}><Text style={{ color: c.textSecondary, fontSize: 20 }}>×</Text></TouchableOpacity>
            </View>
            <TextInput value={storyText} onChangeText={setStoryText} placeholder="Write a text story…" placeholderTextColor={c.textMuted} multiline maxLength={1000} textAlignVertical="top" style={[styles.storyInput, { color: c.text, borderColor: c.border, backgroundColor: c.inputBg }]} />
            <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '700' }}>Who can see this story?</Text>
            <View style={styles.audienceRow}>
              {([['everyone','Everyone'],['followers','Followers'],['only_me','Only me']] as const).map(([value,label]) => (
                <TouchableOpacity key={value} onPress={() => setAudience(value)} style={[styles.audienceBtn, { borderColor: audience === value ? c.primary : c.border, backgroundColor: audience === value ? c.primaryLight : c.surface }]}>
                  <Text style={{ color: audience === value ? c.primary : c.text, fontSize: 11, fontWeight: '800' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={chooseMedia} disabled={uploading} style={[styles.actionBtn, { borderColor: c.border }]}><Text style={{ color: c.text, fontWeight: '800' }}>Photo / Video</Text></TouchableOpacity>
              <TouchableOpacity onPress={publishText} disabled={!storyText.trim() || uploading} style={[styles.actionBtn, { backgroundColor: c.primary, opacity: !storyText.trim() || uploading ? 0.5 : 1 }]}><Text style={{ color: '#fff', fontWeight: '800' }}>Publish text</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {open !== null ? <StoryViewer groups={groups} startGroup={open} meId={meId} onClose={() => { setOpen(null); load(); }} /> : null}
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
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  composer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 32, gap: 14 },
  composerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storyInput: { minHeight: 130, maxHeight: 220, borderWidth: 1, borderRadius: 14, padding: 13, fontSize: 16 },
  audienceRow: { flexDirection: 'row', gap: 8 },
  audienceBtn: { flex: 1, borderWidth: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 13, borderWidth: 1 },
});
