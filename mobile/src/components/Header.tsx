import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, Spacing, Typography } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
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
  const { c, isDark } = useAppColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 12, backgroundColor: c.background, borderBottomColor: c.border },
      ]}
    >
      {onBack ? (
        <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
          <Icon name="arrowLeft" size={24} color={c.primary} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onRightPress ? (
        <TouchableOpacity style={styles.right} onPress={onRightPress} activeOpacity={0.7}>
          {rightIcon ? <Icon name={rightIcon} size={22} color={c.primary} /> : null}
          {rightText ? <Text style={[styles.rightText, { color: c.textSecondary }]}>{rightText}</Text> : null}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: 14,
    height: 56,
    borderBottomWidth: 1,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  back: { padding: 8, marginRight: 4 },
  backText: { fontSize: 24, color: Colors.light.text },
  titleWrap: { flex: 1 },
  title: { ...Typography.screenTitle, color: '#1B1730' },
  subtitle: { ...Typography.bodySmall, color: '#5E5A78', marginTop: 2 },
  right: { padding: 8 },
  rightText: { fontSize: 12, fontWeight: '600' },
});
