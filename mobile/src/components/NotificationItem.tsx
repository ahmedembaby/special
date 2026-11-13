import { View, Text, Image, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { AppNotification } from '../services/social';
import { timeAgo } from '../utils/format';
import { useAppColors } from '../theme/useAppColors';
import { useState } from 'react';
import * as social from '../services/social';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { resolveUrl } from '../config';

export const NotificationItem = ({ item, onDelete, onPress }: { item: AppNotification; onDelete: (id: string) => void; onPress?: () => void }) => {
  const { c } = useAppColors();
  const group = item.group?.name ? ` “${item.group.name}”` : '';
  const meta = {
    like: { icon: 'heartFill' as const, color: c.like, text: item.comment ? 'reacted to your comment' : 'reacted to your post' },
    comment: { icon: 'messageCircle' as const, color: c.primary, text: item.comment ? 'replied to you' : 'replied to your post' },
    follow: { icon: 'userFill' as const, color: c.primary, text: 'started following you' },
    group_invite: { icon: 'users' as const, color: c.primary, text: `invited you to join${group}` },
    group_request: { icon: 'users' as const, color: c.primary, text: `asked to join${group}` },
    group_approved: { icon: 'users' as const, color: c.primary, text: `approved your request to join${group}` },
    mention: { icon: 'messageCircle' as const, color: c.primary, text: item.comment ? 'mentioned you in a comment' : 'mentioned you in a post' },
    follow_request: { icon: 'userFill' as const, color: c.primary, text: 'requested to follow you' },
    follow_accepted: { icon: 'userFill' as const, color: c.primary, text: 'accepted your follow request' },
  }[item.type] || { icon: 'bell' as const, color: c.primary, text: 'sent you a notification' };

  // "Follow back" for follow notifications
  const [following, setFollowing] = useState(!!item.from.is_following);
  const [busy, setBusy] = useState(false);
  const followBack = async () => {
    if (busy) return;
    setBusy(true);
    const was = following;
    setFollowing(!was);
    try { setFollowing(await social.setFollow(item.from.id)); } catch { setFollowing(was); } finally { setBusy(false); }
  };
  const img = resolveUrl(item.post?.image);
  const [answered, setAnswered] = useState<null | 'accepted' | 'declined'>(null);
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    try { await social.answerFollowRequest(item.from.id, accept); setAnswered(accept ? 'accepted' : 'declined'); }
    catch { Alert.alert('Error', 'Could not update the request'); }
    finally { setBusy(false); }
  };

  const confirm = () =>
    Alert.alert('Delete notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
    ]);

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} onLongPress={confirm} style={[styles.row, { borderBottomColor: c.border }]}>
      <View style={styles.iconCol}>
        <View style={[styles.iconTile, { backgroundColor: c.primaryLight }]}>
          <Icon name={meta.icon} size={19} color={meta.color} strokeWidth={2} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.top}>
          <Avatar source={item.from.avatar} name={item.from.name} size={34} userId={item.from.id} />
          <TouchableOpacity onPress={confirm} hitSlop={10}>
            <Icon name="moreHorizontal" size={18} color={c.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.text, { color: c.text }]}>
          <Text style={{ fontWeight: '800' }}>{item.from.name}</Text> {meta.text}
          <Text style={{ color: c.textSecondary }}>  · {timeAgo(item.createdAt)}</Text>
        </Text>
        {item.type === 'follow' ? (
          <TouchableOpacity
            onPress={followBack}
            disabled={busy}
            activeOpacity={0.8}
            style={[styles.followBtn, following ? { borderColor: c.border, borderWidth: 1 } : { backgroundColor: c.text }]}
          >
            <Text style={{ color: following ? c.text : c.background, fontWeight: '800', fontSize: 13 }}>{following ? 'Following' : 'Follow back'}</Text>
          </TouchableOpacity>
        ) : null}
        {item.type === 'follow_request' ? (
          answered ? (
            <Text style={{ color: c.textSecondary, marginTop: 8 }}>{answered === 'accepted' ? 'Request accepted' : 'Request declined'}</Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => answer(true)} disabled={busy} activeOpacity={0.8} style={[styles.followBtn, { backgroundColor: c.text }]}>
                <Text style={{ color: c.background, fontWeight: '800', fontSize: 13 }}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => answer(false)} disabled={busy} activeOpacity={0.8} style={[styles.followBtn, { borderColor: c.border, borderWidth: 1 }]}>
                <Text style={{ color: c.text, fontWeight: '800', fontSize: 13 }}>Decline</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}
        {item.post ? <Text style={[styles.quote, { color: c.textSecondary }]} numberOfLines={3}>{item.post.content}</Text> : null}
        {img ? <Image source={{ uri: img }} style={styles.img} /> : null}
        {item.comment ? (
          <View style={[styles.reply, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={2}>{item.comment.content}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  iconCol: { width: 40, alignItems: 'flex-start', paddingTop: 2 },
  iconTile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 21 },
  quote: { fontSize: 15, marginTop: 4, lineHeight: 21 },
  followBtn: { alignSelf: 'flex-start', borderRadius: 16, paddingHorizontal: 16, height: 32, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  img: { width: '100%', height: 120, borderRadius: 12, marginTop: 8 },
  reply: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10, marginTop: 8 },
});
