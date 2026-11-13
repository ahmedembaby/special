import React, { useRef } from 'react';
import { Animated, PanResponder, View, Text, StyleSheet } from 'react-native';
import { useAppColors } from '../theme/useAppColors';

const TRIGGER = 56;

/** Drag a message to the right to reply to it (like WhatsApp / Telegram). Vertical scrolling is left to the list. */
export const SwipeToReply = ({ enabled = true, onReply, children }: { enabled?: boolean; onReply: () => void; children: React.ReactNode }) => {
  const { c } = useAppColors();
  const x = useRef(new Animated.Value(0)).current;
  const fired = useRef(false);
  const replyRef = useRef(onReply);
  replyRef.current = onReply;

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
    onPanResponderGrant: () => { fired.current = false; },
    onPanResponderMove: (_e, g) => {
      const dx = Math.max(0, Math.min(g.dx, 120));
      x.setValue(dx > TRIGGER ? TRIGGER + (dx - TRIGGER) * 0.25 : dx);
      if (!fired.current && g.dx >= TRIGGER) fired.current = true;
    },
    onPanResponderRelease: () => {
      if (fired.current) replyRef.current();
      Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
  })).current;

  if (!enabled) return <>{children}</>;

  const opacity = x.interpolate({ inputRange: [0, 20, TRIGGER], outputRange: [0, 0.4, 1], extrapolate: 'clamp' });
  const scale = x.interpolate({ inputRange: [0, TRIGGER], outputRange: [0.6, 1], extrapolate: 'clamp' });
  return (
    <View {...pan.panHandlers}>
      <Animated.View pointerEvents="none" style={[styles.icon, { backgroundColor: c.primaryLight, opacity, transform: [{ scale }] }]}>
        <Text style={{ color: c.primary, fontSize: 17, fontWeight: '800' }}>↩</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  icon: { position: 'absolute', left: 8, top: '50%', marginTop: -16, width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
