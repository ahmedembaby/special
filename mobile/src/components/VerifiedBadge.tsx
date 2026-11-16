import React from 'react';
import { View, Text } from 'react-native';

/** Blue check shown next to the name of verified accounts. */
export const VerifiedBadge = ({ size = 16, style }: { size?: number; style?: any }) => (
  <View
    accessible
    accessibilityRole="image"
    accessibilityLabel="Verified account"
    style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1D9BF0', alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 }, style]}
  >
    <Text allowFontScaling={false} style={{ color: '#FFFFFF', fontSize: size * 0.68, fontWeight: '800', lineHeight: size * 0.9 }}>✓</Text>
  </View>
);
