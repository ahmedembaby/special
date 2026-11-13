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

/** Shared flat, compact app header. */
export const ScreenHeader = (p: Props) => {
  const { c } = useAppColors();
  const { lang, t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.shell, { backgroundColor: c.headerBg, borderBottomColor: c.border, paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {p.onBack ? (
            <TouchableOpacity onPress={p.onBack} hitSlop={10} style={[styles.iconBtn, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={t('Go back')}>
              <Icon name={lang === 'ar' ? 'arrowRight' : 'arrowLeft'} size={20} color={c.text} />
            </TouchableOpacity>
          ) : p.onAvatarPress ? (
            <Avatar source={p.avatarUri} name={p.avatarName} size={36} onPress={p.onAvatarPress} />
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
        <View style={styles.actions}>
          {p.onSearchPress ? (
            <TouchableOpacity onPress={p.onSearchPress} hitSlop={8} style={[styles.iconBtn, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={t('Search')}>
              <Icon name="search" size={20} color={c.text} />
            </TouchableOpacity>
          ) : null}
          {p.onMessagesPress ? (
            <TouchableOpacity onPress={p.onMessagesPress} hitSlop={8} style={[styles.iconBtn, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={t('Messages')}>
              <Icon name="mail" size={20} color={c.text} />
            </TouchableOpacity>
          ) : null}
          {!p.onSearchPress && !p.onMessagesPress && p.rightIcon ? (
            <TouchableOpacity onPress={p.onRightPress} hitSlop={10} style={[styles.iconBtn, { backgroundColor: c.card }]} accessibilityRole="button">
              <Icon name={p.rightIcon} size={20} color={c.text} />
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
  shell: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  side: { width: 44, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 8 },
  logoCenter: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10 },
  actions: { minWidth: 44, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  logoDot: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
