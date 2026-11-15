import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as api from '../services/api';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from '../components/Icon';
import { VerifiedBadge } from '../components/VerifiedBadge';

const CATEGORIES: Array<[string, string]> = [['person', 'Public figure'], ['creator', 'Creator'], ['business', 'Business'], ['organization', 'Organization']];

/** Request the verification badge; the decision is made in the admin console. */
export default function VerificationScreen() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const [status, setStatus] = useState<api.VerificationStatus | null>(null);
  const [category, setCategory] = useState('person');
  const [reason, setReason] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setStatus((await api.verification.status()).data); } catch { setStatus({ verified: false, request: null }); } }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    try { await api.verification.request({ category, reason: reason.trim(), link: link.trim() || undefined }); setReason(''); setLink(''); await load(); Alert.alert('Sent', 'We will review your request and notify you.'); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.message || 'Could not send the request'); } finally { setBusy(false); }
  };

  const pending = status?.request?.status === 'pending';
  const rejected = status?.request?.status === 'rejected';
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back"><Icon name="arrowLeft" size={24} color={c.text} /></TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Account verification</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {!status ? <ActivityIndicator color={c.primary} /> : status.verified ? (
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <VerifiedBadge size={56} />
            <Text style={[styles.lead, { color: c.text, marginTop: 14 }]}>Your account is verified</Text>
          </View>
        ) : pending ? (
          <Text style={[styles.body, { color: c.text }]}>Your request is under review. You will get a notification when a decision is made.</Text>
        ) : (
          <>
            {rejected ? <Text style={[styles.body, { color: c.danger }]}>Your last request was declined{status.request?.review_note ? `: ${status.request.review_note}` : '.'}</Text> : null}
            <Text style={[styles.body, { color: c.textSecondary }]}>The badge confirms that an account is authentic and notable. Tell us who you are.</Text>
            <View style={styles.chips}>
              {CATEGORIES.map(([id, label]) => (
                <TouchableOpacity key={id} onPress={() => setCategory(id)} accessibilityRole="radio" accessibilityState={{ selected: category === id }} accessibilityLabel={label}
                  style={[styles.chip, { borderColor: category === id ? c.primary : c.border, backgroundColor: category === id ? c.primary : 'transparent' }]}>
                  <Text style={{ color: category === id ? '#fff' : c.text, fontWeight: '600' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={reason} onChangeText={setReason} multiline maxLength={1000} placeholder="Why should this account be verified?" placeholderTextColor={c.textMuted}
              accessibilityLabel="Reason" style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.inputBg, minHeight: 110, textAlignVertical: 'top' }]} />
            <TextInput value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" placeholder="Link to a website or profile (optional)" placeholderTextColor={c.textMuted}
              accessibilityLabel="Link" style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.inputBg }]} />
            <TouchableOpacity onPress={submit} disabled={busy || reason.trim().length < 10} accessibilityRole="button" accessibilityLabel="Send request"
              style={[styles.btn, { backgroundColor: c.primary, opacity: busy || reason.trim().length < 10 ? 0.5 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send request</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  lead: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
