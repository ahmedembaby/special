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
      <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.textMuted }]} />
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
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingBottom: 28, overflow: 'hidden' },
  handle: { width: 38, height: 4, borderRadius: 3, alignSelf: 'center', opacity: 0.42, marginBottom: 10 },
  title: { textAlign: 'center', paddingVertical: 16, paddingHorizontal: 18, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, minHeight: 54 },
  label: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
});
