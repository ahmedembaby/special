import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { useAppColors } from '../theme/useAppColors';
import { isEncrypted, decrypt } from '../services/e2ee';
const previewText = (t: string) => (t.startsWith('sticker:') ? `Sticker ${t.slice(8)}` : t.startsWith('📍 http') ? '📍 Location' : t);

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
    <TouchableOpacity style={[styles.item, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow }]} onPress={onPress} activeOpacity={0.7}>
      <Avatar
        source={item.type === 'group' ? item.avatar : participant.avatar}
        name={name}
        size={52}
        status={item.type === 'group' ? undefined : participant.status}
        userId={item.type === 'group' ? undefined : participant.id}
      />
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.nameRow}>
            {item.pinned ? <Icon name="pin" size={13} color={c.textSecondary} /> : null}
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{name}</Text>
            {isVerified ? <Icon name="verified" size={14} color={c.primary} strokeWidth={1.2} /> : null}
            {item.muted ? <Icon name="bellOff" size={13} color={c.textSecondary} /> : null}
            {handle ? <Text style={[styles.handle, { color: c.textSecondary }]} numberOfLines={1}>{handle}</Text> : null}
          </View>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>{timeLabel(item.last_message_at)}</Text>
        </View>
        <View style={styles.bottom}>
          <Text style={{ color: unread ? c.text : c.textSecondary, fontWeight: unread ? '700' : '400', fontSize: 15, marginTop: 2, flex: 1 }} numberOfLines={1}>{draft ? <Text><Text style={{ color: c.danger, fontWeight: '700' }}>Draft: </Text>{draft}</Text> : lastMessage}</Text>
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
  item: { flexDirection: 'row', marginHorizontal: 14, marginTop: 8, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 13, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  body: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  handle: { fontSize: 14, flexShrink: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 22, height: 22, borderRadius: 8, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
