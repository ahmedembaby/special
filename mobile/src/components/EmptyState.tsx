import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../theme/index';
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
      <Icon name={icon} size={64} color={c.textMuted} />
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 40,
  },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { ...Typography.h3, color: '#1B1730', marginBottom: 8 },
  subtitle: { ...Typography.bodySmall, color: '#5E5A78', textAlign: 'center' },
});
