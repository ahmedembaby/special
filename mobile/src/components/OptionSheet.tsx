import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAppColors } from '../theme/useAppColors';

export interface SheetOption { label: string; onPress: () => void; danger?: boolean; selected?: boolean }

/** Bottom sheet with a list of actions. */
export const OptionSheet = ({ visible, title, options, onClose }: { visible: boolean; title?: string; options: SheetOption[]; onClose: () => void }) => {
  const { c } = useAppColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.background }]}>
        {title ? <Text style={[styles.title, { color: c.textSecondary, borderBottomColor: c.border }]}>{title}</Text> : null}
        <ScrollView style={{ maxHeight: 420 }}>
        {options.map((o) => (
          <TouchableOpacity key={o.label} style={styles.row} activeOpacity={0.7} onPress={() => { onClose(); setTimeout(o.onPress, 0); }}>
            <Text style={[styles.label, { color: o.danger ? c.danger : c.text }]}>{o.label}</Text>
            {o.selected ? <Text style={{ color: c.primary, fontSize: 16 }}>✓</Text> : null}
          </TouchableOpacity>
        ))}
        </ScrollView>
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onClose}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 24 },
  title: { textAlign: 'center', paddingVertical: 14, fontSize: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 22 },
  label: { fontSize: 16 },
});
