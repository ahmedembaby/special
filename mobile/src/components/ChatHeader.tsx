import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { Icon, IconName } from './Icon';
import { CachedImage } from './CachedImage';
import { useAppColors } from '../theme/useAppColors';

interface Props {
  name: string;
  avatarUri?: string | null;
  subtitle: string;
  /** Small status icons shown before the subtitle (encrypted, muted, disappearing). */
  statusIcons?: IconName[];
  online?: boolean;
  /** Extra actions on the end side. Each is rendered as a round button. */
  actions: { icon: any; label: string; onPress: () => void }[];
  onBack: () => void;
  onProfile?: () => void;
}

/** Chat top bar: brand-colour bar with white content in light mode, the plain card bar in dark mode. */
export const ChatHeader = ({ name, avatarUri, subtitle, statusIcons, online, actions, onBack, onProfile }: Props) => {
  const { c, isDark } = useAppColors();
  const bar = c.card;
  const fg = c.text;
  const sub = online ? c.success : c.textSecondary;
  const iconCol = c.primary;
  const btnBg = c.background;
  return (
    <View style={[styles.header, { backgroundColor: bar, shadowColor: c.shadow, borderBottomColor: c.divider }]}>
      <TouchableOpacity style={[styles.back, { backgroundColor: c.background, borderColor: c.border }]} onPress={onBack} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Back">
        <Icon name="arrowLeft" size={20} color={c.text} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.info} activeOpacity={onProfile ? 0.7 : 1} onPress={onProfile} accessibilityRole={onProfile ? 'button' : undefined}>
        {avatarUri ? (
          <CachedImage source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: c.primary }]}>
            <Text style={styles.initial}>{name ? name.charAt(0).toUpperCase() : 'U'}</Text>
          </View>
        )}
        <View style={styles.names}>
          <Text style={[styles.name, { color: fg }]} numberOfLines={1}>{name || ' '}</Text>
          {subtitle || statusIcons?.length ? (
            <View style={styles.subRow}>
              {statusIcons?.map((n) => <Icon key={n} name={n} size={12} color={sub} />)}
              {subtitle ? <Text style={[styles.sub, { color: sub }]} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        {actions.map((a) => (
          <TouchableOpacity key={a.label} style={[styles.btn, { backgroundColor: btnBg, borderColor: c.border }]} activeOpacity={0.8} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label}>
            <Icon name={a.icon} size={20} color={iconCol} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 66, marginBottom: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 38, height: 38, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0, marginStart: 6, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginEnd: 10 },
  initial: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  names: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 13, flexShrink: 1 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { width: 38, height: 38, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
