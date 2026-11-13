import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, Typography } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
  gradient?: string[];
}

export const GradientButton = ({
  title,
  onPress,
  disabled = false,
  style,
  textStyle,
  gradient,
}: GradientButtonProps) => {
  const { c } = useAppColors();
  const fill = gradient ?? [c.primary, c.primary];
  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={(disabled ? [c.disabledBtn, c.disabledBtn] : fill) as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill as any}
      />
      <Text style={[styles.text, disabled && styles.disabledText, textStyle]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...Typography.button,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  disabledText: {
    color: 'rgba(255,255,255,0.6)',
  },
});
