import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import api from '../services/api';
import { resolveUrl } from '../config';
import { useAppColors } from '../theme/useAppColors';

/** Shows people matching the @word being typed at the end of `text`; picking one completes it. */
export const MentionSuggest = ({ text, onPick }: { text: string; onPick: (newText: string) => void }) => {
  const { c } = useAppColors();
  const [users, setUsers] = useState<any[]>([]);
  const match = /(?:^|\s)@([a-zA-Z0-9_]{1,30})$/.exec(text);
  const q = match ? match[1] : '';

  useEffect(() => {
    if (q.length < 1) { setUsers([]); return undefined; }
    const t = setTimeout(() => {
      api.get('/search/users', { params: { q } }).then((r) => setUsers((r.data || []).filter((u: any) => u.username).slice(0, 5))).catch(() => setUsers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!match || !users.length) return null;
  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
      {users.map((u) => (
        <TouchableOpacity key={u.id} style={styles.row} onPress={() => onPick(text.replace(/@[a-zA-Z0-9_]{1,30}$/, `@${u.username} `))}>
          {resolveUrl(u.avatar) ? <Image source={{ uri: resolveUrl(u.avatar) || undefined }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: c.primary }]} />}
          <View>
            <Text style={{ color: c.text, fontWeight: '700' }}>{u.name}</Text>
            <Text style={{ color: c.textSecondary }}>@{u.username}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
});
