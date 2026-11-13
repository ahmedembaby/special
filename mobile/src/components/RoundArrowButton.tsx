import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from './Icon';

/** 60px circular "next" button (gradient when enabled, pale blue when disabled). */
export const RoundArrowButton = ({
  onPress, disabled = false, loading = false,
}: { onPress: () => void; disabled?: boolean; loading?: boolean }) => {
  const { c } = useAppColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={styles.btn}
    >
      <LinearGradient
        colors={(disabled ? [c.disabledBtn, c.disabledBtn] : [c.primary, c.primary]) as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill as any}
      />
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="arrowRight" size={28} color="#FFFFFF" />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 60, height: 60, borderRadius: 30, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
});

export default RoundArrowButton;
