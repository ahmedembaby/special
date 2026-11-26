import React from 'react';
import { View, Text, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';

interface Props {
  icon: IconName;
  color: string;
  size?: number;
  children: React.ReactNode;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  gap?: number;
}

/** An icon followed by a label on one line (menu chips, status lines, media previews). */
export const IconText = ({ icon, color, size = 16, children, textStyle, style, numberOfLines, gap = 6 }: Props) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
    <Icon name={icon} size={size} color={color} />
    <Text style={[{ color }, textStyle]} numberOfLines={numberOfLines}>{children}</Text>
  </View>
);

export const MEDIA_PREVIEW: Record<string, { icon: IconName; label: string }> = {
  image: { icon: 'image', label: 'Photo' },
  voice: { icon: 'mic', label: 'Voice message' },
  file: { icon: 'file', label: 'File' },
  poll: { icon: 'poll', label: 'Poll' },
};
