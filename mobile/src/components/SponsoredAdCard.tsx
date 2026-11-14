import React, { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api from '../services/api';
import { resolveUrl } from '../config';
import { useAppColors } from '../theme/useAppColors';

type SponsoredCampaign = {
  id: number;
  headline: string;
  body?: string | null;
  media_url?: string | null;
  target_url: string;
};

export const SponsoredAdCard = () => {
  const { c } = useAppColors();
  const [ad, setAd] = useState<SponsoredCampaign | null>(null);

  useEffect(() => {
    let alive = true;
    api.get('/ads').then(({ data }) => {
      if (alive && data?.id && data?.target_url) setAd(data);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const openAd = async () => {
    if (!ad) return;
    try {
      const { data } = await api.post('/ads/' + ad.id + '/click');
      const url = String(data?.target_url || '');
      if (/^https?:\/\//i.test(url)) await Linking.openURL(url);
    } catch {}
  };

  if (!ad) return null;
  const imageUri = resolveUrl(ad.media_url || null);
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.header}>
        <Text style={[styles.sponsored, { color: c.primary }]}>إعلان ممول</Text>
        <Text style={[styles.label, { color: c.textSecondary }]}>محتوى برعاية</Text>
      </View>
      <TouchableOpacity onPress={openAd} activeOpacity={0.88}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" /> : null}
        <Text style={[styles.headline, { color: c.text }]}>{ad.headline}</Text>
        {ad.body ? <Text style={[styles.body, { color: c.textSecondary }]} numberOfLines={3}>{ad.body}</Text> : null}
        <View style={[styles.cta, { backgroundColor: c.primary }]}>
          <Text style={styles.ctaText}>اعرف المزيد</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 12, marginBottom: 8, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sponsored: { fontSize: 12, fontWeight: '800' },
  label: { fontSize: 11 },
  image: { width: '100%', height: 170, borderRadius: 12, marginBottom: 10, backgroundColor: '#D1D5DB' },
  headline: { fontSize: 16, fontWeight: '800', textAlign: 'left' },
  body: { fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'left' },
  cta: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 10 },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
});
