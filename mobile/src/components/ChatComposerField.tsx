import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useAppColors } from '../theme/useAppColors';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  /** Handlers spread onto the mic button (the screen owns hold-to-record). */
  micProps?: object;
  canSend: boolean;
  sending?: boolean;
  onSend: () => void;
}

/** The normal (not recording) input row: attach, mic, text field, round send button. */
export const ChatComposerField = ({ value, onChangeText, placeholder, micProps, canSend, sending, onSend }: Props) => {
  const { c } = useAppColors();
  return (
    <>
      <View style={[styles.mic, { backgroundColor: c.surface }]} {...(micProps || {})}>
        <Icon name="mic" size={20} color={c.primary} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, { color: c.text }]}
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        multiline
        underlineColorAndroid="transparent"
      />
      {canSend ? (
        <TouchableOpacity style={[styles.send, { backgroundColor: sending ? c.disabledBtn : c.primary }]} onPress={onSend} disabled={sending} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Send">
          <Icon name="sendFeather" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  mic: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginEnd: 6 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: 'transparent', borderWidth: 0, minHeight: 40, maxHeight: 120, textAlignVertical: 'center' },
  send: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginStart: 8 },
});
