import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppColors } from '../theme/useAppColors';
import { useI18n } from '../i18n';

/** Pill-style segmented control ("For you" / "Following"). */
export const TopTabs = ({ tabs, active, onChange }: { tabs: string[]; active: number; onChange: (i: number) => void }) => {
  const { c } = useAppColors();
  const { t } = useI18n();
  return (
    <View style={[styles.row, { backgroundColor: c.inputBg }]}>
      {tabs.map((t, i) => (
        <TouchableOpacity
          key={t}
          style={[styles.tab, i === active && { backgroundColor: c.card, shadowColor: c.shadow, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }]}
          onPress={() => onChange(i)}
          activeOpacity={0.8}
        >
          <Text style={[styles.label, { color: i === active ? c.primary : c.textSecondary, fontWeight: i === active ? '700' : '500' }]}>{t(tabs[i])}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 8, padding: 4, borderRadius: 16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12 },
  label: { fontSize: 14 },
});
