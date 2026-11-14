import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import * as api from '../services/api';

export default function BlockedUsersScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const [items, setItems] = useState<api.User[] | null>(null);
  useEffect(() => { api.safety.blocks().then((r) => setItems(r.data || [])).catch(() => setItems([])); }, []);
  const unblock = async (u: api.User) => {
    try {
      await api.safety.block(u.id);
      setItems((p) => (p || []).filter((x) => x.id !== u.id));
    } catch {
      Alert.alert("Could not unblock account", "Please check your connection and try again.");
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Blocked accounts" onBack={() => nav.goBack()} />
      {items === null ? <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} /> : (
        <FlatList
          data={items}
          keyExtractor={(u) => String(u.id)}
          ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 60 }}>You have not blocked anyone.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: c.border }]}>
              <Avatar source={item.avatar} name={item.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>{item.name}</Text>
                {item.username ? <Text style={{ color: c.textSecondary }}>@{item.username}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => unblock(item)} style={[styles.btn, { borderColor: c.border, backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={`Unblock ${item.name}`}>
                <Text style={{ color: c.text, fontWeight: '700' }}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, marginHorizontal: 14, marginTop: 8, padding: 15, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  btn: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, height: 36, alignItems: 'center', justifyContent: 'center' },
});
