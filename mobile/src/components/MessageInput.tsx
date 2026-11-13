import { useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

export const MessageInput = ({ value, onChangeText, onSend, onTyping, disabled }: MessageInputProps) => {
  const { c } = useAppColors();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const setTyping = (flag: boolean) => {
    if (isTypingRef.current === flag) return;
    isTypingRef.current = flag;
    onTyping?.(flag);
  };

  const handleChange = (text: string) => {
    onChangeText(text);
    setTyping(text.length > 0);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 1500);
  };

  const handleSend = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    onSend();
  };

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
    []
  );

  const canSend = !!value.trim() && !disabled;

  return (
    <View style={[styles.inputWrapper, { backgroundColor: c.card, borderTopColor: c.border }]}>
      <TextInput
        placeholder="Start a message..."
        placeholderTextColor={c.placeholder}
        value={value}
        onChangeText={handleChange}
        multiline
        style={[styles.input, { backgroundColor: c.inputBg, borderWidth: 0, borderRadius: 18, color: c.text }]}
      />
      <TouchableOpacity
        style={[styles.sendBtn, { backgroundColor: canSend ? c.primary : c.disabledBtn }]}
        onPress={handleSend}
        disabled={!canSend}
      >
        <Text style={styles.sendText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    marginRight: 10,
    minHeight: 40,
    maxHeight: 120,
  },
  sendBtn: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
    sendText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
