import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, BorderRadius } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
import { Icon, IconName } from './Icon';

const statusIcon = (status: string | undefined): IconName => {
  switch (status) {
    case 'sending': return 'clock';
    case 'sent': return 'check';
    default: return 'checkRead';
  }
};

interface MessageBubbleProps {
  message: string;
  isOwn: boolean;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  onLongPress?: () => void;
}

export const MessageBubble = ({ message, isOwn, time, status = 'sent', onLongPress }: MessageBubbleProps) => {
  const { c } = useAppColors();
  const bubbleBg = isOwn ? c.ownMessageBg : c.otherMessageBg;
  const textColor = isOwn ? c.ownMessageText : c.otherMessageText;
  const metaColor = isOwn ? 'rgba(255,255,255,0.85)' : c.timestamp;

  return (
    <View style={[styles.wrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]}>
      <TouchableOpacity
        style={[styles.bubble, { backgroundColor: bubbleBg }]}
        onLongPress={onLongPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.text, { color: textColor }]}>{message}</Text>
        <View style={styles.meta}>
          <Text style={[styles.time, { color: metaColor }]}>{time}</Text>
          {isOwn ? <Icon name={statusIcon(status)} size={13} color={status === 'read' ? (isOwn ? '#FFFFFF' : c.primary) : metaColor} /> : null}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', marginVertical: 6, paddingHorizontal: 12 },
  ownWrapper: { justifyContent: 'flex-end' },
  otherWrapper: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  text: { ...Typography.body, lineHeight: 22 },
  meta: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'baseline', marginTop: 5 },
  time: { ...Typography.caption, marginRight: 4 },
  status: { ...Typography.caption },
});
