import React, { useEffect, useState } from 'react';
import { View, Text, Switch, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { ScreenHeader } from '../components/ScreenHeader';
import { OptionSheet } from '../components/OptionSheet';
import { useI18n } from '../i18n';
import * as api from '../services/api';

type S = api.UserSettings;
const DEFAULTS: S = {
  hide_presence: false, read_receipts: true, who_can_message: 'everyone',
  notif: { like: true, comment: true, follow: true, mention: true, message: true, reply: true, group: true },
  quiet: { enabled: false, start: 22, end: 7 },
  digest: { enabled: false, hour: 20 },
};
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function PrivacySettingsScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const { t } = useI18n();
  const [s, setS] = useState<S>(DEFAULTS);
  const [sheet, setSheet] = useState<null | 'who' | 'start' | 'end' | 'digestHour'>(null);

  useEffect(() => {
    api.users.getSettings().then((r) => setS({ ...DEFAULTS, ...r.data, notif: { ...DEFAULTS.notif, ...(r.data?.notif || {}) }, quiet: { ...DEFAULTS.quiet, ...(r.data?.quiet || {}) }, digest: { ...DEFAULTS.digest, ...(r.data?.digest || {}) } })).catch(() => {});
  }, []);

  const save = async (next: S, prev: S) => {
    setS(next);
    try { await api.users.putSettings({ ...next, quiet: { ...next.quiet, tz: -new Date().getTimezoneOffset() } }); }
    catch { setS(prev); Alert.alert('Error', 'Could not save your settings'); }
  };
  const patch = (p: Partial<S>) => save({ ...s, ...p }, s);
  const setNotif = (k: keyof S['notif'], v: boolean) => save({ ...s, notif: { ...s.notif, [k]: v } }, s);
  const setQuiet = (p: Partial<S['quiet']>) => save({ ...s, quiet: { ...s.quiet, ...p } }, s);
  const setDigest = (p: Partial<S['digest']>) => save({ ...s, digest: { ...s.digest, ...p } }, s);

  const sw = (v: boolean, f: (v: boolean) => void) => (
    <Switch value={v} onValueChange={f} accessibilityRole="switch" accessibilityLabel="Privacy or notification preference" trackColor={{ false: c.inputBorder, true: c.primary }} thumbColor="#FFFFFF" />
  );
  const Row = ({ title, sub, right, onPress }: { title: string; sub?: string; right?: React.ReactNode; onPress?: () => void }) => (
    <TouchableOpacity style={[styles.row, { backgroundColor: c.card, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={title}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {sub ? <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );
  const Section = ({ title }: { title: string }) => <Text style={[styles.section, { color: c.text }]}>{title}</Text>;
  const whoLabel = { everyone: t('Everyone'), followed: t('Only people I follow'), nobody: t('Nobody') }[s.who_can_message];
  const hours = (key: 'start' | 'end') => Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h), selected: s.quiet[key] === h, onPress: () => setQuiet({ [key]: h }) }));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title={t('Privacy & notifications')} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Section title={t('Messages')} />
        <Row title={t('Hide online status')} sub={t('Others will not see when you are online or your last seen')} right={sw(s.hide_presence, (v) => patch({ hide_presence: v }))} />
        <Row title={t('Read receipts')} sub={t('If off, people will not see when you read their messages')} right={sw(s.read_receipts, (v) => patch({ read_receipts: v }))} />
        <Row title={t('Who can message me')} sub={whoLabel} onPress={() => setSheet('who')} />

        <Section title={t('Notifications')} />
        <Row title={t('Messages notifications')} right={sw(s.notif.message, (v) => setNotif('message', v))} />
        <Row title={t('Likes and reactions')} right={sw(s.notif.like, (v) => setNotif('like', v))} />
        <Row title={t('Comments')} right={sw(s.notif.comment, (v) => setNotif('comment', v))} />
        <Row title={t('New followers')} right={sw(s.notif.follow, (v) => setNotif('follow', v))} />
        <Row title={t('Mentions')} right={sw(s.notif.mention, (v) => setNotif('mention', v))} />
        <Row title="Replies to my messages" sub="Receive a separate push preference for replies" right={sw(s.notif.reply, (v) => setNotif('reply', v))} />
        <Row title={t('Groups')} right={sw(s.notif.group, (v) => setNotif('group', v))} />

        <Section title="Daily digest" />
        <Row title="Daily notification summary" sub="Receive one daily push with your unread notification count" right={sw(s.digest.enabled, (v) => setDigest({ enabled: v }))} />
        {s.digest.enabled ? <Row title="Send at" sub={hourLabel(s.digest.hour)} onPress={() => setSheet('digestHour')} /> : null}

        <Section title={t('Quiet hours')} />
        <Row title={t('Quiet hours')} sub={t('No push notifications during these hours')} right={sw(s.quiet.enabled, (v) => setQuiet({ enabled: v }))} />
        {s.quiet.enabled ? (
          <>
            <Row title={t('From')} sub={hourLabel(s.quiet.start)} onPress={() => setSheet('start')} />
            <Row title={t('To')} sub={hourLabel(s.quiet.end)} onPress={() => setSheet('end')} />
          </>
        ) : null}
      </ScrollView>

      <OptionSheet visible={sheet === 'who'} title={t('Who can message me')} onClose={() => setSheet(null)} options={[
        { label: t('Everyone'), selected: s.who_can_message === 'everyone', onPress: () => patch({ who_can_message: 'everyone' }) },
        { label: t('Only people I follow'), selected: s.who_can_message === 'followed', onPress: () => patch({ who_can_message: 'followed' }) },
        { label: t('Nobody'), selected: s.who_can_message === 'nobody', onPress: () => patch({ who_can_message: 'nobody' }) },
      ]} />
      <OptionSheet visible={sheet === 'start'} title={t('From')} onClose={() => setSheet(null)} options={hours('start')} />
      <OptionSheet visible={sheet === 'end'} title={t('To')} onClose={() => setSheet(null)} options={hours('end')} />
      <OptionSheet visible={sheet === 'digestHour'} title="Daily digest time" onClose={() => setSheet(null)} options={Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h), selected: s.digest.hour === h, onPress: () => setDigest({ hour: h }) }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 9, paddingHorizontal: 17, paddingVertical: 15, borderRadius: 22 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.62, paddingHorizontal: 22, paddingTop: 27, paddingBottom: 6 },
});
