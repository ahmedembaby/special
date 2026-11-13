import { Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import { useAppColors } from '../theme/useAppColors';

const TOKEN = /(^|[^\w@])(@[a-zA-Z0-9_]{3,30})|(^|[^\p{L}\p{N}_&#])(#[\p{L}\p{N}_]{2,50})/gu;

/** Text with tappable @mentions (open the profile) and #hashtags (open the hashtag page). */
export const RichText = ({ text, style, numberOfLines }: { text: string; style?: any; numberOfLines?: number }) => {
  const nav = useNavigation() as any;
  const { c } = useAppColors();

  const openUser = async (username: string) => {
    try {
      const r = await api.get('/search/users', { params: { q: username } });
      const hit = (r.data || []).find((u: any) => String(u.username).toLowerCase() === username.toLowerCase());
      if (hit) nav.navigate('UserProfile', { userId: String(hit.id) });
      else Alert.alert('Not found', `@${username} does not exist.`);
    } catch { /* offline */ }
  };

  const parts: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const lead = (m[1] ?? m[3] ?? '');
    const tok = m[2] ?? m[4];
    const start = (m.index ?? 0) + lead.length;
    if (start > last) parts.push(text.slice(last, start));
    const isMention = tok.startsWith('@');
    parts.push(
      <Text key={k++} style={{ color: c.primary }} onPress={() => (isMention ? openUser(tok.slice(1)) : nav.navigate('Hashtag', { tag: tok.slice(1).toLowerCase() }))}>
        {tok}
      </Text>
    );
    last = start + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Text style={style} numberOfLines={numberOfLines}>{parts}</Text>;
};
