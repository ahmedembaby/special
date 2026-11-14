import React from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useThemeSettings } from '../context/ThemeContext';
import { useAppColors } from '../theme/useAppColors';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon, IconName } from '../components/Icon';
import * as api from '../services/api';
import { API_BASE } from '../config';
import { Linking, Share } from 'react-native';
import { useI18n } from '../i18n';
import { OptionSheet } from '../components/OptionSheet';

/** "Settings and privacy" — merges the old Settings + More screens. */
export default function SettingsScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const { logout, user, updateUser } = useAuth();
  const { lang, t, setLang } = useI18n();
  const [langSheet, setLangSheet] = React.useState(false);
  const togglePrivate = async (value: boolean) => {
    updateUser({ is_private: value });
    try { await api.users.updateMe({ is_private: value }); }
    catch { updateUser({ is_private: !value }); Alert.alert('Error', 'Could not update your account privacy'); }
  };
  const { darkMode, setDarkMode } = useThemeSettings();

  const Row = ({ icon, title, sub, onPress, right, danger }: { icon: IconName; title: string; sub?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean }) => (
    <TouchableOpacity style={[styles.row, { backgroundColor: c.card, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.iconBox, { backgroundColor: danger ? c.background : c.primaryLight }]}><Icon name={icon} size={20} color={danger ? c.danger : c.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? c.danger : c.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {sub ? <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {right ?? (onPress && !danger ? <Icon name="chevronRight" size={18} color={c.textMuted} /> : null)}
    </TouchableOpacity>
  );
  const Section = ({ t }: { t: string }) => <Text style={[styles.section, { color: c.text }]}>{t}</Text>;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader title={t('Settings')} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Section t="Your account" />
        <Row icon="user" title={t('Account information')} sub={t('Name, bio and profile photo')} onPress={() => nav.navigate('ProfileEdit')} />
        <Row
          icon="lock"
          title="Private account"
          sub="Only people you approve can follow you and see your posts and stories"
          right={<Switch value={!!user?.is_private} onValueChange={togglePrivate} trackColor={{ false: c.inputBorder, true: c.primary }} thumbColor="#FFFFFF" />}
        />
        <Row icon="bookmark" title={t('Starred messages')} onPress={() => nav.navigate('Starred')} />
        <Row icon="lock" title={t('Privacy & notifications')} onPress={() => nav.navigate('PrivacySettings')} />
        <Row icon="lock" title={t('Encryption key backup')} sub="Keep your encrypted chats after reinstalling or on a second phone" onPress={() => nav.navigate('KeyBackup')} />
        <Row icon="bookmark" title={t('Saved posts')} onPress={() => nav.navigate('Hashtag', { bookmarks: true })} />
        <Row icon="user" title={t('Blocked accounts')} onPress={() => nav.navigate('BlockedUsers')} />
        <Row icon="lock" title={t('Security')} sub="PIN, Face ID and fingerprint" onPress={() => nav.navigate('Security')} />
        <Row icon="user" title="Devices and sessions" sub="Review and sign out devices connected to your account" onPress={() => nav.navigate('Sessions')} />

        {user?.is_admin ? (
          <>
            <Section t="Administration" />
            <Row icon="settings" title="Admin dashboard" sub="Users, conversations and broadcasts" onPress={() => nav.navigate('AdminDashboard')} />
          </>
        ) : null}

        <Section t="Display" />
        <Row
          icon="moon" title="Dark mode" sub="Lights out for your eyes"
          right={<Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: c.inputBorder, true: c.primary }} thumbColor="#FFFFFF" />}
        />
        <Row icon="globe" title={t('Language')} sub={lang === 'ar' ? 'العربية' : 'English'} onPress={() => setLangSheet(true)} />
        <OptionSheet visible={langSheet} title={t('Language')} onClose={() => setLangSheet(false)} options={[{ label: 'English', selected: lang === 'en', onPress: () => setLang('en') }, { label: 'العربية', selected: lang === 'ar', onPress: () => setLang('ar') }]} />

        <Section t="Notifications" />
        <Row icon="bellOff" title="Mute notifications" right={<Switch value={false} onValueChange={() => {}} trackColor={{ false: c.inputBorder, true: c.primary }} thumbColor="#FFFFFF" />} />
        <Row icon="eye" title="Hide chat history" right={<Switch value={false} onValueChange={() => {}} trackColor={{ false: c.inputBorder, true: c.primary }} thumbColor="#FFFFFF" />} />

        <Section t="About" />
        <Row
          icon="file"
          title="Download my data"
          sub="A copy of your profile, posts and messages"
          onPress={async () => {
            try { const r = await api.safety.exportData(); await Share.share({ message: JSON.stringify(r.data, null, 2), title: 'my-data.json' }); }
            catch { Alert.alert('Error', 'Could not export your data'); }
          }}
        />
        <Row icon="file" title={t('Privacy policy')} onPress={() => Linking.openURL(`${API_BASE}/privacy`)} />
        <Row icon="trash" title={t('Delete account')} danger onPress={() => nav.navigate('DeleteAccount')} />
        <Row icon="file" title={t('Terms of Service')} onPress={() => nav.navigate('Terms', { title: 'Term of Service' })} />
        <Row icon="help" title="About app" onPress={() => nav.navigate('Terms', { title: 'About App' })} />
        <Row icon="help" title="Help Center" />

        <View style={[styles.sep, { backgroundColor: c.border }]} />
        <Row
          icon="logout" title="Log out" danger
          onPress={() => Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: logout },
          ])}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.62, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 15, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20 },
  iconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
});
