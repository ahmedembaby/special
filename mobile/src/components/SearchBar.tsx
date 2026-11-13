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
    <View style={[styles.wrap, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}>
      <View style={[styles.iconWrap, { backgroundColor: c.primaryLight }]}>
        <Icon name="search" size={16} color={c.primary} strokeWidth={2.1} />
      </View>
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
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8} style={[styles.clear, { backgroundColor: c.primary }]}>
          <Icon name="x" size={11} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, height: 48, gap: 10 },
  iconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 0, fontWeight: '500' },
  clear: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
