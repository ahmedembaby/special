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
        <Icon name="search" size={17} color={c.primary} strokeWidth={2.1} />
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
        accessibilityLabel={placeholder}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8} style={[styles.clear, { backgroundColor: c.primary }]} accessibilityRole="button" accessibilityLabel="Clear search">
          <Icon name="x" size={12} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, height: 50, gap: 11 },
  iconWrap: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 0, fontWeight: '550' },
  clear: { width: 24, height: 24, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
