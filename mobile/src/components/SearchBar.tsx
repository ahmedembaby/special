import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from './Icon';

interface SearchBarProps {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

export const SearchBar = ({ value, onChangeText, placeholder = 'Search', autoFocus, onSubmit }: SearchBarProps) => {
  const { c } = useAppColors();
  return (
    <View style={[styles.wrap, { backgroundColor: c.inputBg }]}>
      <Icon name="search" size={18} color={c.textMuted} />
      <TextInput
        style={[styles.input, { color: c.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.placeholder}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <View style={[styles.clear, { backgroundColor: c.primary }]}>
            <Icon name="x" size={11} color="#FFFFFF" strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, height: 46, gap: 10 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  clear: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
