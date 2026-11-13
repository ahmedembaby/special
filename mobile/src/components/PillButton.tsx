import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppColors } from '../theme/useAppColors';

/** "Skip" (secondary, pale) / "Continue" (primary gradient) pill buttons from the security screens. */
export const PillButton = ({
  title, onPress, variant = 'primary', disabled = false,
}: { title: string; onPress: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean }) => {
  const { c } = useAppColors();
  const primary = variant === 'primary';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.btn, { backgroundColor: primary ? 'transparent' : c.skipBg }, disabled && primary && { backgroundColor: c.disabledBtn }]}
    >
      {primary && !disabled ? (
        <LinearGradient colors={[c.primary, c.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
      ) : null}
      <Text style={[styles.text, { color: primary ? '#FFFFFF' : c.skipText }]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: { flex: 1, height: 54, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontWeight: '600' },
});

export default PillButton;
