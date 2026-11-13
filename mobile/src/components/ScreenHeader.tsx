import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import { useI18n } from '../i18n';
import { Icon, IconName } from './Icon';
import { Avatar } from './Avatar';

interface Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  avatarUri?: string | null;
  avatarName?: string;
  onAvatarPress?: () => void;
  logo?: boolean;
  rightIcon?: IconName;
  onRightPress?: () => void;
  rightText?: string;
  children?: React.ReactNode;
}

/** Shared top bar for social and messaging screens. */
export const ScreenHeader = (p: Props) => {
  const { c } = useAppColors();
  const { lang } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: c.headerBg, paddingTop: insets.top, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
      <View style={styles.row}>
        <View style={styles.side}>
          {p.onBack ? (
            <TouchableOpacity onPress={p.onBack} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
              <Icon name={lang === 'ar' ? 'arrowRight' : 'arrowLeft'} size={21} color={c.text} />
            </TouchableOpacity>
          ) : p.onAvatarPress ? (
            <Avatar source={p.avatarUri} name={p.avatarName} size={34} onPress={p.onAvatarPress} />
          ) : null}
        </View>
        <View style={[styles.center, p.logo ? styles.logoCenter : null]}>
          {p.logo ? (
            <>
              <View style={[styles.logoDot, { backgroundColor: c.primary }]}><Icon name="bubble" size={18} color="#FFFFFF" strokeWidth={2.1} /></View>
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
            <TouchableOpacity onPress={p.onRightPress} hitSlop={10} style={styles.iconBtn} accessibilityRole="button">
              <Icon name={p.rightIcon} size={21} color={c.text} />
            </TouchableOpacity>
          ) : p.rightText ? (
            <TouchableOpacity onPress={p.onRightPress} hitSlop={10}>
              <Text style={{ color: c.primary, fontWeight: '700', fontSize: 14 }}>{p.rightText}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {p.children}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  side: { width: 42, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 8 },
  logoCenter: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 9 },
  logoDot: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '750', letterSpacing: -0.35 },
  sub: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
