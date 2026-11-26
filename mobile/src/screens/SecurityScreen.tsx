import { useCallback } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StatusBar, Switch, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Typography, Spacing, BorderRadius } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
import { Icon, IconName } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAppLock } from '../context/AppLockContext';
import * as lock from '../services/appLock';

const NAV_ROWS: { screen: string; label: string; icon: IconName }[] = [
  { screen: 'PINSecurity', label: 'PIN Security', icon: 'pin' },
  { screen: 'FaceID', label: 'Face Recognition', icon: 'face' },
  { screen: 'TouchID', label: 'Fingerprint Security', icon: 'fingerprint' },
];

export default function SecurityScreen() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const { settings, refresh } = useAppLock();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const toggleLock = (on: boolean) => {
    if (on) return navigation.navigate('PINSecurity');
    // turning it off needs the current PIN (same screen as changing it)
    navigation.navigate('PINSecurity', { disable: true });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader title="Security" onBack={() => navigation.goBack()} />
      <View style={styles.list}>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.row, { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View style={styles.rowLeft}>
              <Icon name="lock" size={22} color={c.text} />
              <Text style={[styles.rowTitle, { color: c.text }]}>App Lock</Text>
            </View>
            <Switch
              value={settings.pinEnabled}
              onValueChange={toggleLock}
              accessibilityLabel="App Lock"
              accessibilityHint="Require your PIN to open the app"
              trackColor={{ false: c.border, true: c.primary }}
            />
          </View>
          {NAV_ROWS.map((r, i) => (
            <TouchableOpacity
              key={r.screen}
              style={[styles.row, i < NAV_ROWS.length - 1 ? { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth } : null]}
              onPress={() => navigation.navigate(r.screen)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={r.label}
            >
              <View style={styles.rowLeft}>
                <Icon name={r.icon} size={22} color={c.text} />
                <Text style={[styles.rowTitle, { color: c.text }]}>{r.label}</Text>
              </View>
              <Icon name="chevronRight" size={20} color={c.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={[styles.changePIN, { backgroundColor: c.primary }]} activeOpacity={0.8} onPress={() => navigation.navigate('PINSecurity')} accessibilityRole="button" accessibilityLabel={settings.pinEnabled ? "Change PIN" : "Set PIN"}>
        <View style={styles.changePINIcon}><Icon name="pen" size={20} color={'#FFFFFF'} /></View>
        <Text style={[styles.changePINText, { color: '#FFFFFF' }]}>{settings.pinEnabled ? 'Change PIN' : 'Set PIN'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    flex: 1,
    padding: 16,
  },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, minHeight: 56 },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  rowTitle: {
    marginStart: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1730',
  },
  rowRight: {},
  rowArrow: {
    fontSize: 16,
    color: '#8A86A3',
  },
  changePIN: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: BorderRadius.button,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  changePINIcon: {
    fontSize: 20,
    marginRight: 10,
    color: '#FFFFFF',
  },
  changePINText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
}) as any;
