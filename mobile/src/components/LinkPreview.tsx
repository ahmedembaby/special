import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useAppColors } from '../theme/useAppColors';
import * as api from '../services/api';

const URL_RE = /https?:\/\/[^\s<>"']+/i;
export const firstUrl = (text: string): string | null => {
  const m = URL_RE.exec(text || '');
  if (!m) return null;
  return m[0].replace(/[).,;!?]+$/, '');
};

const memo = new Map<string, api.LinkPreviewData | null>();

/** Title / description / image card for the first link of a message (fetched by the server). */
export const LinkPreview = ({ url, isOwn }: { url: string; isOwn?: boolean }) => {
  const { c } = useAppColors();
  const [data, setData] = useState<api.LinkPreviewData | null | undefined>(memo.has(url) ? memo.get(url) : undefined);

  useEffect(() => {
    if (memo.has(url)) { setData(memo.get(url)); return undefined; }
    let alive = true;
    api.messages.linkPreview(url)
      .then((r) => { memo.set(url, r.data.preview); if (alive) setData(r.data.preview); })
      .catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [url]);

  if (!data) return null;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(data.url).catch(() => {})}
      style={[styles.card, { backgroundColor: isOwn ? 'rgba(255,255,255,0.16)' : c.inputBg }]}>
      {data.image ? <Image source={{ uri: data.image }} style={styles.img} resizeMode="cover" /> : null}
      <View style={{ padding: 10 }}>
        <Text style={[styles.site, { color: isOwn ? 'rgba(255,255,255,0.75)' : c.textMuted }]} numberOfLines={1}>{data.site}</Text>
        {data.title ? <Text style={[styles.title, { color: isOwn ? '#FFFFFF' : c.text }]} numberOfLines={2}>{data.title}</Text> : null}
        {data.description ? <Text style={[styles.desc, { color: isOwn ? 'rgba(255,255,255,0.85)' : c.textSecondary }]} numberOfLines={2}>{data.description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 10, borderRadius: 17, overflow: 'hidden', width: 252, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(110,120,150,0.22)' },
  img: { width: '100%', height: 132 },
  site: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 14, fontWeight: '800', lineHeight: 19, marginTop: 4 },
  desc: { fontSize: 12, lineHeight: 17, marginTop: 4 },
});
