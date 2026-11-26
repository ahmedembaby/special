import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppColors } from '../theme/useAppColors';

/** Placeholder card with the same outer shape as PostCard, shown while the feed loads. */
export const PostSkeleton = () => {
  const { c } = useAppColors();
  const bar = (w: number | string, h = 12, mt = 0) => (
    <View style={{ width: w as any, height: h, borderRadius: h / 2, backgroundColor: c.inputBg, marginTop: mt }} />
  );
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.avatar, { backgroundColor: c.inputBg }]} />
      <View style={styles.body}>
        {bar('45%', 13)}
        {bar('92%', 12, 12)}
        {bar('70%', 12, 8)}
        <View style={{ height: 160, borderRadius: 20, backgroundColor: c.inputBg, marginTop: 14 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', marginHorizontal: 18, marginTop: 10, padding: 17, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, gap: 13 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  body: { flex: 1 },
});
