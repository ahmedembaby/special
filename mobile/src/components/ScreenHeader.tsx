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
  messageBadge?: number;
  children?: React.ReactNode;
}

/** Premium shared header: calm surface, generous spacing and consistent controls. */
export const ScreenHeader = (p: Props) => {
  const { c } = useAppColors();
  const { lang, t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.shell, { backgroundColor: c.headerBg, borderBottomColor: c.divider, paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {p.onBack ? (
            <TouchableOpacity onPress={p.onBack} hitSlop={10} style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="button" accessibilityLabel={t('Go back')}>
              <Icon name={lang === 'ar' ? 'arrowRight' : 'arrowLeft'} size={20} color={c.text} />
            </TouchableOpacity>
          ) : p.onAvatarPress ? (
            <Avatar source={p.avatarUri} name={p.avatarName} size={40} onPress={p.onAvatarPress} />
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
            <TouchableOpacity onPress={p.onSearchPress} hitSlop={8} style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="button" accessibilityLabel={t('Search')}>
              <Icon name="search" size={20} color={c.text} />
            </TouchableOpacity>
          ) : null}
          {p.onMessagesPress ? (
            <TouchableOpacity onPress={p.onMessagesPress} hitSlop={8} style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="button" accessibilityLabel={t('Messages')}>
              <Icon name="mail" size={20} color={c.text} />
              {Number(p.messageBadge) > 0 ? <View style={[styles.countBadge, { backgroundColor: c.danger }]}><Text style={styles.countBadgeText}>{Number(p.messageBadge) > 99 ? '99+' : p.messageBadge}</Text></View> : null}
            </TouchableOpacity>
          ) : null}
          {!p.onSearchPress && !p.onMessagesPress && p.rightIcon ? (
            <TouchableOpacity onPress={p.onRightPress} hitSlop={10} style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="button" accessibilityLabel={p.rightIcon}>
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
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  side: { width: 46, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 8, minWidth: 0 },
  logoCenter: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10 },
  actions: { minWidth: 46, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 9 },
  logoDot: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.65 },
  sub: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  iconBtn: { width: 42, height: 42, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  countBadge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  countBadgeText: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontWeight: '900' },
});
