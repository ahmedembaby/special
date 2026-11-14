import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { AppNotification } from '../services/social';
import { timeAgo } from '../utils/format';
import { useAppColors } from '../theme/useAppColors';
import * as social from '../services/social';
import { Avatar } from './Avatar';
import { Icon, IconName } from './Icon';
import { resolveUrl } from '../config';
import { useI18n } from '../i18n';

interface Props {
  item: AppNotification;
  /** shown with a highlight until the user has seen it */
  unread?: boolean;
  onDelete: (id: string) => void;
  onPress?: () => void;
}

export const NotificationItem = ({ item, unread, onDelete, onPress }: Props) => {
  const { c } = useAppColors();
  const { t } = useI18n();
  const group = item.group?.name ? ` “${item.group.name}”` : '';
  const isSystem = item.from.id === 'system' || item.type === 'broadcast' || item.type === 'digest';

  const meta: { icon: IconName; color: string; text: string } = ({
    like: { icon: 'heartFill', color: c.like, text: item.comment ? t('reacted to your comment') : t('reacted to your post') },
    comment: { icon: 'messageCircle', color: c.primary, text: item.comment ? t('replied to you') : t('replied to your post') },
    follow: { icon: 'userFill', color: c.success, text: t('started following you') },
    follow_request: { icon: 'userFill', color: c.success, text: t('requested to follow you') },
    follow_accepted: { icon: 'userFill', color: c.success, text: t('accepted your follow request') },
    group_invite: { icon: 'users', color: c.primaryDark, text: t('invited you to join') + group },
    group_request: { icon: 'users', color: c.primaryDark, text: t('asked to join') + group },
    group_approved: { icon: 'users', color: c.primaryDark, text: t('approved your request to join') + group },
    mention: { icon: 'messageCircle', color: c.primary, text: item.comment ? t('mentioned you in a comment') : t('mentioned you in a post') },
    broadcast: { icon: 'bell', color: c.primary, text: t('published an announcement') },
    digest: { icon: 'bell', color: c.primary, text: t('sent your daily notification summary') },
    message: { icon: 'messageCircle', color: c.primary, text: t('sent you a message') },
    reply: { icon: 'messageCircle', color: c.primary, text: t('replied to your message') },
  } as Record<string, { icon: IconName; color: string; text: string }>)[item.type] || { icon: 'bell', color: c.primary, text: t('sent you a notification') };

  const [following, setFollowing] = useState(!!item.from.is_following);
  const [busy, setBusy] = useState(false);
  const followBack = async () => {
    if (busy) return;
    setBusy(true);
    const was = following;
    setFollowing(!was);
    try { setFollowing(await social.setFollow(item.from.id)); } catch { setFollowing(was); } finally { setBusy(false); }
  };
  const [answered, setAnswered] = useState<null | 'accepted' | 'declined'>(null);
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    try { await social.answerFollowRequest(item.from.id, accept); setAnswered(accept ? 'accepted' : 'declined'); }
    catch { Alert.alert(t('Error'), t('Could not update the request')); }
    finally { setBusy(false); }
  };

  const confirm = () =>
    Alert.alert(t('Delete notification'), t('Remove this notification?'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: () => onDelete(item.id) },
    ]);

  const img = resolveUrl(item.post?.image);
  const filledBtn = [styles.btn, { backgroundColor: c.primary }];
  const outlineBtn = [styles.btn, { borderColor: c.border, borderWidth: 1, backgroundColor: c.card }];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      onLongPress={confirm}
      style={[styles.row, { borderBottomColor: c.divider, backgroundColor: unread ? c.primaryLight : 'transparent' }]}
    >
      <View style={styles.lead}>
        {isSystem ? (
          <View style={[styles.systemTile, { backgroundColor: c.primary }]}>
            <Icon name="bell" size={22} color="#FFFFFF" strokeWidth={2} />
          </View>
        ) : (
          <>
            <Avatar source={item.from.avatar} name={item.from.name} size={46} userId={item.from.id} />
            <View style={[styles.badge, { backgroundColor: meta.color, borderColor: unread ? c.primaryLight : c.background }]}>
              <Icon name={meta.icon} size={11} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.text, { color: c.text }]} numberOfLines={3}>
            <Text style={styles.name}>{isSystem ? (item.from.name || 'Special') : item.from.name}</Text> {meta.text}
          </Text>
          <View style={styles.side}>
            <Text style={[styles.time, { color: unread ? c.primary : c.textMuted, fontWeight: unread ? '800' : '600' }]}>{timeAgo(item.createdAt)}</Text>
            <TouchableOpacity onPress={confirm} hitSlop={12} accessibilityLabel={t('Delete notification')}>
              <Icon name="moreHorizontal" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {item.type === 'broadcast' ? (
          <View style={[styles.announce, { backgroundColor: c.card, borderColor: c.border }]}>
            {item.title ? <Text style={[styles.announceTitle, { color: c.text }]}>{item.title}</Text> : null}
            {item.body ? <Text style={[styles.announceBody, { color: c.textSecondary }]}>{item.body}</Text> : null}
          </View>
        ) : null}

        {item.post || item.comment ? (
          <View style={styles.quoteRow}>
            <View style={[styles.quote, { borderColor: c.border, backgroundColor: c.card }]}>
              {item.comment ? <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }} numberOfLines={2}>{item.comment.content}</Text> : null}
              {item.post ? <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: item.comment ? 4 : 0 }} numberOfLines={2}>{item.post.content}</Text> : null}
            </View>
            {img ? <Image source={{ uri: img }} style={styles.thumb} /> : null}
          </View>
        ) : null}

        {item.type === 'follow' ? (
          <View style={styles.actions}>
            <TouchableOpacity onPress={followBack} disabled={busy} activeOpacity={0.8} style={following ? outlineBtn : filledBtn}>
              <Text style={{ color: following ? c.text : '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{following ? t('Following') : t('Follow back')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {item.type === 'follow_request' ? (
          answered ? (
            <Text style={{ color: c.textSecondary, marginTop: 10, fontSize: 13 }}>{answered === 'accepted' ? t('Request accepted') : t('Request declined')}</Text>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => answer(true)} disabled={busy} activeOpacity={0.8} style={filledBtn}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{t('Accept')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => answer(false)} disabled={busy} activeOpacity={0.8} style={outlineBtn}>
                <Text style={{ color: c.text, fontWeight: '800', fontSize: 13 }}>{t('Decline')}</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  lead: { width: 46, height: 46 },
  systemTile: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', end: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  body: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  text: { flex: 1, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  name: { fontWeight: '800' },
  side: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 12 },
  announce: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, marginTop: 10 },
  announceTitle: { fontSize: 15, fontWeight: '800', lineHeight: 21 },
  announceBody: { fontSize: 14, lineHeight: 21, marginTop: 4 },
  quoteRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 10 },
  quote: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, justifyContent: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { borderRadius: 16, paddingHorizontal: 18, height: 34, alignItems: 'center', justifyContent: 'center' },
});
