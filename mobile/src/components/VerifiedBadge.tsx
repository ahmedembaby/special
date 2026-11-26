import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from './Icon';

/** Blue check shown next to the name of verified accounts. */
export const VerifiedBadge = ({ size = 16, style }: { size?: number; style?: any }) => (
  <View
    accessible
    accessibilityRole="image"
    accessibilityLabel="Verified account"
    style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1D9BF0', alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 }, style]}
  >
    <Icon name="check" size={Math.round(size * 0.7)} color="#FFFFFF" strokeWidth={3.5} />
  </View>
);
