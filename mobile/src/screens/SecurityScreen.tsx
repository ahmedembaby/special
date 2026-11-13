import { useCallback } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StatusBar, Switch, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from '../components/Icon';
import { useAppLock } from '../context/AppLockContext';
import * as lock from '../services/appLock';

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

  const row = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: c.background,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <TouchableOpacity style={styles.backWrap} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Icon name="arrowLeft" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Security</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.list}>
        <View style={[(row as any), { borderBottomWidth: 1, borderBottomColor: c.border }]}>
          <View style={styles.rowLeft}>
            <Icon name="lock" size={22} color={c.text} />
            <Text style={[styles.rowTitle, { color: c.text }]}>App Lock</Text>
          </View>
          <View style={styles.rowRight}>
            <Switch
              value={settings.pinEnabled}
              onValueChange={toggleLock}
              trackColor={{ false: c.border, true: c.primary }}
            />
          </View>
        </View>
        <View style={[(row as any), { borderBottomWidth: 1, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => navigation.navigate('PINSecurity')} activeOpacity={0.8}>
            <View style={styles.rowLeft}>
              <Icon name="pin" size={22} color={c.text} />
              <Text style={[styles.rowTitle, { color: c.text }]}>PIN Security</Text>
            </View>
            <Icon name="chevronRight" size={22} color={c.text} />
          </TouchableOpacity>
        </View>
        <View style={[(row as any), { borderBottomWidth: 1, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => navigation.navigate('FaceID')} activeOpacity={0.8}>
            <View style={styles.rowLeft}>
              <Icon name="face" size={22} color={c.text} />
              <Text style={[styles.rowTitle, { color: c.text }]}>Face Recognition</Text>
            </View>
            <Icon name="chevronRight" size={22} color={c.text} />
          </TouchableOpacity>
        </View>
        <View style={[(row as any), { borderBottomWidth: 1, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => navigation.navigate('TouchID')} activeOpacity={0.8}>
            <View style={styles.rowLeft}>
              <Icon name="fingerprint" size={22} color={c.text} />
              <Text style={[styles.rowTitle, { color: c.text }]}>Fingerprint Security</Text>
            </View>
            <Icon name="chevronRight" size={22} color={c.text} />
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.changePIN} activeOpacity={0.8} onPress={() => navigation.navigate('PINSecurity')}>
        <View style={styles.changePINIcon}><Icon name="pen" size={20} color={'#FFFFFF'} /></View>
        <Text style={[styles.changePINText, { color: '#FFFFFF' }]}>{settings.pinEnabled ? 'Change PIN' : 'Set PIN'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 54,
    paddingBottom: 16,
    borderBottomWidth: 1,
    height: 70,
  },
  backWrap: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 24 },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B1730',
  },
  list: {
    flex: 1,
  },
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
    fontSize: 16,
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
    backgroundColor: '#6C4DF6',
    borderRadius: BorderRadius.button,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: Spacing.lg,
    marginVertical: 16,
    shadowColor: '#6C4DF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
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
