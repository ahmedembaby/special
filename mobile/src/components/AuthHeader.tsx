import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from './Icon';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
  detail?: string;
  backLabel: string;
  onBack: () => void;
  variant?: 'curve' | 'flat';
  height?: number;
  children?: React.ReactNode;
}

export const AuthHeader = ({
  title, subtitle, detail, backLabel, onBack, variant = 'curve', height, children,
}: AuthHeaderProps) => {
  const { c, isDark } = useAppColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const H = height ?? (variant === 'curve' ? 260 : 220);
  return (
    <View style={{ height: H, width, backgroundColor: c.background }}>
      <View style={[styles.row, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          style={[styles.pill, { backgroundColor: c.pillBg }]}
        >
          <Icon name="arrowLeft" size={20} color={c.text} />
          <Text style={[styles.pillText, { color: c.text }]}>{backLabel}</Text>
        </TouchableOpacity>
        <Icon name="bubble" size={30} color={c.primary} strokeWidth={2.2} />
      </View>

      <View style={styles.sub}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: c.text }]}>{subtitle}</Text>
        {detail ? <Text style={[styles.detail, { color: c.textSecondary }]}>{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  pill: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillText: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  sub: { paddingHorizontal: 24, marginTop: 24 },
  subtitle: { fontSize: 19, fontWeight: '600', marginTop: 8, lineHeight: 27, letterSpacing: -0.2 },
  detail: { fontSize: 14, fontWeight: '500', marginTop: 8, lineHeight: 20 },
});

export default AuthHeader;
