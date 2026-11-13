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
  onSearchPress?: () => void;
  onMessagesPress?: () => void;
  children?: React.ReactNode;
}

/** Shared top bar for social and messaging screens. */
export const ScreenHeader = (p: Props) => {
  const { c } = useAppColors();
  const { lang, t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: c.headerBg, paddingTop: insets.top, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
      <View style={styles.row}>
        <View style={styles.side}>
          {p.onBack ? (
            <TouchableOpacity onPress={p.onBack} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t("Go back")}>
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
        <View style={[styles.actions, { alignItems: 'flex-end' }]}>
          {p.onSearchPress ? (
            <TouchableOpacity onPress={p.onSearchPress} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('Search')}>
              <Icon name="search" size={25} color={c.text} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
          {p.onMessagesPress ? (
            <TouchableOpacity onPress={p.onMessagesPress} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('Messages')}>
              <Icon name="mail" size={25} color={c.text} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
          {!p.onSearchPress && !p.onMessagesPress && p.rightIcon ? (
            <TouchableOpacity onPress={p.onRightPress} hitSlop={10} style={styles.iconBtn} accessibilityRole="button">
              <Icon name={p.rightIcon} size={21} color={c.text} />
            </TouchableOpacity>
          ) : !p.onSearchPress && !p.onMessagesPress && p.rightText ? (
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
  actions: { width: 96, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  logoDot: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', letterSpacing: -0.35 },
  sub: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
