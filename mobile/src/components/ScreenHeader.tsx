import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import { Icon, IconName } from './Icon';
import { Avatar } from './Avatar';

interface Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** show the user's avatar on the left (opens profile) */
  avatarUri?: string | null;
  avatarName?: string;
  onAvatarPress?: () => void;
  /** show app logo in the center instead of a title */
  logo?: boolean;
  rightIcon?: IconName;
  onRightPress?: () => void;
  rightText?: string;
  children?: React.ReactNode;
}

/** X-style top bar: avatar / back on the left, title or logo in the middle, action on the right. */
export const ScreenHeader = (p: Props) => {
  const { c } = useAppColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: c.background, paddingTop: insets.top }}>
      <View style={styles.row}>
        <View style={styles.side}>
          {p.onBack ? (
            <TouchableOpacity onPress={p.onBack} hitSlop={10} style={styles.iconBtn}>
              <Icon name="arrowLeft" size={22} color={c.text} />
            </TouchableOpacity>
          ) : p.onAvatarPress ? (
            <Avatar source={p.avatarUri} name={p.avatarName} size={32} onPress={p.onAvatarPress} />
          ) : null}
        </View>
        <View style={[styles.center, p.logo ? { flexDirection: 'row', justifyContent: 'flex-start', gap: 8 } : null]}>
          {p.logo ? (
            <>
              <View style={[styles.logoDot, { backgroundColor: c.primary }]}><Icon name="bubble" size={18} color="#FFFFFF" strokeWidth={2.2} /></View>
              <Text style={[styles.title, { color: c.text }]}>Special</Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{p.title}</Text>
              {p.subtitle ? <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>{p.subtitle}</Text> : null}
            </>
          )}
        </View>
        <View style={[styles.side, { alignItems: 'flex-end' }]}>
          {p.rightIcon ? (
            <TouchableOpacity onPress={p.onRightPress} hitSlop={10} style={styles.iconBtn}>
              <Icon name={p.rightIcon} size={22} color={c.text} />
            </TouchableOpacity>
          ) : p.rightText ? (
            <TouchableOpacity onPress={p.onRightPress} hitSlop={10}>
              <Text style={{ color: c.primary, fontWeight: '700', fontSize: 15 }}>{p.rightText}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {p.children}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  side: { minWidth: 44, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 8 },
  logoDot: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sub: { fontSize: 12, marginTop: 1 },
  iconBtn: { padding: 8, borderRadius: 14 },
});
