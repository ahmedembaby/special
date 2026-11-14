import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { useAppColors } from '../theme/useAppColors';
import { isEncrypted, decrypt } from '../services/e2ee';

const previewText = (t: string) =>
  t.startsWith('sticker:') ? `Sticker ${t.slice(8)}` : t.startsWith('📍 http') ? '📍 Location' : t;

export interface ChatItemProps {
  item: any;
  onPress: () => void;
  /** unsent text typed in this chat */
  draft?: string;
}

export const getChatName = (item: any) =>
  item.type === 'group' ? item.name || 'Group' : item.participants?.[0]?.name || item.name || 'User';

const timeLabel = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86400000 && new Date().getDate() === d.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * 86400000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const ChatItem = ({ item, onPress, draft }: ChatItemProps) => {
  const { c } = useAppColors();
  const participant = item.participants?.[0] || {};
  const name = getChatName(item);
  const lastMessage =
    item.last_message_type === 'image' ? '📷 Photo'
    : item.last_message_type === 'voice' ? '🎤 Voice message'
    : item.last_message_type === 'file' ? '📎 File'
    : item.last_message_type === 'poll' ? '📊 Poll'
    : isEncrypted(item.last_message) ? previewText(decrypt(participant.public_key, item.last_message) ?? '🔒 Encrypted message')
    : (item.last_message || '').startsWith('sticker:') ? previewText(item.last_message!)
    : item.last_message || 'No messages yet';
  const unread = Number(item.unread_count) || 0;
  const isVerified = item.verified || participant.verified || false;
  const handle = item.type === 'group' ? null : participant.username ? `@${participant.username}` : null;

  return (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: c.divider }]}
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${name}`}
    >
      <Avatar
        source={item.type === 'group' ? item.avatar : participant.avatar}
        name={name}
        size={54}
        status={item.type === 'group' ? undefined : participant.status}
        userId={item.type === 'group' ? undefined : participant.id}
      />
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.nameRow}>
            {item.pinned ? <Icon name="pin" size={13} color={c.textMuted} /> : null}
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{name}</Text>
            {isVerified ? <Icon name="verified" size={15} color={c.primary} strokeWidth={1.4} /> : null}
            {item.muted ? <Icon name="bellOff" size={13} color={c.textMuted} /> : null}
          </View>
          <Text style={[styles.time, { color: unread ? c.primary : c.textMuted }]}>{timeLabel(item.last_message_at)}</Text>
        </View>
        <View style={styles.bottom}>
          <View style={styles.previewWrap}>
            {draft ? <Text style={[styles.preview, { color: c.textSecondary }]} numberOfLines={1}><Text style={{ color: c.danger, fontWeight: '800' }}>Draft: </Text>{draft}</Text> : (
              <Text style={[styles.preview, { color: unread ? c.text : c.textSecondary, fontWeight: unread ? '600' : '400' }]} numberOfLines={1}>{lastMessage}</Text>
            )}
            {handle ? <Text style={[styles.handle, { color: c.textMuted }]} numberOfLines={1}>{handle}</Text> : null}
          </View>
          {unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: c.primary }]}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    marginHorizontal: 18,
    paddingVertical: 15,
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, minWidth: 0, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
  name: { fontSize: 15.5, fontWeight: '750', letterSpacing: -0.2, flexShrink: 1 },
  time: { fontSize: 11, fontWeight: '600' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewWrap: { flex: 1, minWidth: 0, gap: 2 },
  preview: { fontSize: 13, lineHeight: 19 },
  handle: { fontSize: 11, lineHeight: 14 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
