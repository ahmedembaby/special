import { useEffect, useRef, useState, useCallback } from 'react';
import { Modal, View, Image, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Alert, Platform } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { resolveUrl } from '../config';
import * as social from '../services/social';
import { OptionSheet } from './OptionSheet';

const { width: W } = Dimensions.get('window');

/** Story video (expo-video works in Expo Go). Drives the progress bar and calls onEnd when finished. */
const StoryVideo = ({ uri, onProgress, onEnd }: { uri: string; onProgress: (p: number) => void; onEnd: () => void }) => {
  const player = useVideoPlayer({ uri }, (p) => { p.timeUpdateEventInterval = 0.2; p.play(); });
  useEffect(() => {
    const a = player.addListener('timeUpdate', (e: any) => { if (player.duration > 0) onProgress(e.currentTime / player.duration); });
    const b = player.addListener('playToEnd', onEnd);
    return () => { a.remove(); b.remove(); };
  }, [player, onProgress, onEnd]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
};
const IMAGE_MS = 5000;

interface Props {
  groups: social.StoryGroup[];
  startGroup: number;
  meId: string;
  onClose: (changed?: boolean) => void;
}

/** Full-screen story player: tap right/left to move, auto-advances, owner sees viewers and can delete. */
export const StoryViewer = ({ groups: initial, startGroup, meId, onClose }: Props) => {
  const [groups, setGroups] = useState(initial);
  const [g, setG] = useState(startGroup);
  const [i, setI] = useState(0);
  const [viewers, setViewers] = useState<social.SocialUser[] | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const changed = useRef(false);

  const group = groups[g];
  const story = group?.stories[i];
  const mine = group?.user.id === meId;

  const next = useCallback(() => {
    const grp = groups[g];
    if (i < grp.stories.length - 1) setI(i + 1);
    else if (g < groups.length - 1) { setG(g + 1); setI(0); }
    else onClose(changed.current);
  }, [g, i, groups, onClose]);

  const prev = () => {
    if (i > 0) setI(i - 1);
    else if (g > 0) { setG(g - 1); setI(0); }
  };

  useEffect(() => {
    if (!story) return undefined;
    progress.setValue(0);
    if (!mine && !story.seen) { social.markStorySeen(story.id); changed.current = true; }
    if (story.media_type === 'video') return undefined; // the player drives progress
    const anim = Animated.timing(progress, { toValue: 1, duration: IMAGE_MS, useNativeDriver: false });
    anim.start(({ finished }) => finished && next());
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, i, story?.id]);

  const remove = () => {
    Alert.alert('Delete story', 'This story will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await social.deleteStory(story.id);
            changed.current = true;
            const rest = group.stories.filter((s) => s.id !== story.id);
            if (!rest.length) {
              const gs = groups.filter((_, k) => k !== g);
              if (!gs.length) return onClose(true);
              setGroups(gs); setG(Math.min(g, gs.length - 1)); setI(0);
            } else {
              setGroups(groups.map((x, k) => (k === g ? { ...x, stories: rest } : x)));
              setI(Math.min(i, rest.length - 1));
            }
          } catch { Alert.alert('Error', 'Could not delete the story'); }
        },
      },
    ]);
  };

  if (!story) return null;
  const uri = resolveUrl(story.media_url) || undefined;
  const avatar = resolveUrl(group.user.avatar);

  return (
    <Modal visible animationType="fade" onRequestClose={() => onClose(changed.current)} statusBarTranslucent>
      <View style={styles.root}>
        {story.media_type === 'video' ? (
          <StoryVideo key={story.id} uri={uri!} onProgress={(p) => progress.setValue(p)} onEnd={next} />
        ) : (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        )}

        <View style={styles.touch}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={prev} />
          <TouchableOpacity style={{ flex: 2 }} activeOpacity={1} onPress={next} />
        </View>

        <View style={styles.top}>
          <View style={styles.bars}>
            {group.stories.map((s, k) => (
              <View key={s.id} style={styles.barBg}>
                <Animated.View style={[styles.barFill, { width: k < i ? '100%' : k === i ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }]} />
              </View>
            ))}
          </View>
          <View style={styles.userRow}>
            {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: '#6C4DF6' }]} />}
            <Text style={styles.name}>{mine ? 'Your story' : group.user.name}</Text>
            <Text style={styles.time}>{new Date(story.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            <View style={{ flex: 1 }} />
            {mine ? <TouchableOpacity onPress={remove} hitSlop={10}><Text style={styles.icon}>🗑</Text></TouchableOpacity> : null}
            <TouchableOpacity onPress={() => onClose(changed.current)} hitSlop={10}><Text style={styles.icon}>✕</Text></TouchableOpacity>
          </View>
        </View>

        {story.caption ? <Text style={styles.caption}>{story.caption}</Text> : null}
        {mine ? (
          <TouchableOpacity style={styles.viewersBtn} onPress={async () => setViewers(await social.getStoryViewers(story.id).catch(() => []))}>
            <Text style={styles.viewersText}>👁 Viewers</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <OptionSheet
        visible={viewers !== null}
        title={`Seen by ${viewers?.length || 0}`}
        options={(viewers || []).slice(0, 15).map((v) => ({ label: v.name, onPress: () => {} }))}
        onClose={() => setViewers(null)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  touch: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', top: 120, bottom: 90 },
  top: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 34, left: 10, right: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  barBg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#fff' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  name: { color: '#fff', fontWeight: '700', fontSize: 15 },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  icon: { color: '#fff', fontSize: 20, paddingHorizontal: 6 },
  caption: { position: 'absolute', bottom: 80, left: 20, right: 20, color: '#fff', fontSize: 17, textAlign: 'center', textShadowColor: '#000', textShadowRadius: 6 },
  viewersBtn: { position: 'absolute', bottom: 34, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  viewersText: { color: '#fff', fontWeight: '700' },
});
