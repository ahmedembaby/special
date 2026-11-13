import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography } from '../theme';
import { useAppColors } from '../theme/useAppColors';
import { useI18n } from '../i18n';
import { Icon, IconName } from './Icon';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onRightPress?: () => void;
  rightIcon?: IconName;
  rightText?: string;
}

export const Header = ({ title, subtitle, onBack, onRightPress, rightIcon = 'search', rightText }: HeaderProps) => {
  const { c } = useAppColors();
  const { lang } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top + 8, backgroundColor: c.headerBg, borderBottomColor: c.border },
    ]}>
      {onBack ? (
        <TouchableOpacity style={styles.iconButton} onPress={onBack} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name={lang === 'ar' ? 'arrowRight' : 'arrowLeft'} size={21} color={c.text} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {onRightPress ? (
        <TouchableOpacity style={styles.iconButton} onPress={onRightPress} activeOpacity={0.7} accessibilityRole="button">
          {rightIcon ? <Icon name={rightIcon} size={21} color={c.text} /> : null}
          {rightText ? <Text style={[styles.rightText, { color: c.primary }]}>{rightText}</Text> : null}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    minWidth: 40, minHeight: 40, padding: 8, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  titleWrap: { flex: 1, paddingHorizontal: 8 },
  title: { ...Typography.screenTitle, fontSize: 20 },
  subtitle: { ...Typography.bodySmall, marginTop: 2 },
  rightText: { fontSize: 13, fontWeight: '700' },
});
