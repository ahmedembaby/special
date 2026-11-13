import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Typography } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';

interface TypingIndicatorProps {
  names?: string[];
}

const Dot = ({ delay, color }: { delay: number; color: string }) => {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  return <Animated.View style={[styles.dot, { opacity: anim, backgroundColor: color }]} />;
};

export const TypingIndicator = ({ names = [] }: TypingIndicatorProps) => {
  const { c } = useAppColors();
  const label =
    names.length === 0 ? '' : names.length === 1 ? `${names[0]} is typing` : `${names.length} people are typing`;

  return (
    <View style={styles.container}>
      <Dot delay={0} color={c.textSecondary} />
      <Dot delay={150} color={c.textSecondary} />
      <Dot delay={300} color={c.textSecondary} />
      {label ? <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 4 },
  label: { ...Typography.bodySmall, marginLeft: 4 },
});
