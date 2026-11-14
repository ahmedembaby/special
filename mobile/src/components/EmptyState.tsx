import { View, Text, StyleSheet } from 'react-native';
import { Typography, Spacing } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
import { Icon, IconName } from './Icon';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
}

export const EmptyState = ({ title, subtitle, icon = 'chat' }: EmptyStateProps) => {
  const { c } = useAppColors();
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.iconWrap}>
        <Icon name={icon} size={52} color={c.textMuted} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 44,
    gap: 10,
  },
  iconWrap: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.h3, color: '#1B1730', textAlign: 'center' },
  subtitle: { ...Typography.bodySmall, color: '#5E5A78', textAlign: 'center' },
});
