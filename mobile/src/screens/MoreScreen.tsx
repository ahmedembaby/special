import { SafeAreaView, View, Text, TouchableOpacity, StatusBar, Switch, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useThemeSettings } from '../context/ThemeContext';
import { Colors, Typography, Spacing, BorderRadius } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
import { Icon, IconName } from '../components/Icon';

export default function MoreScreen() {
  const navigation = useNavigation() as any;
  const { isDark } = useAppColors();
  const { logout } = useAuth();
  const { darkMode, setDarkMode } = useThemeSettings();

  const rowBase = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  };

  const menuItems = [
    { icon: 'globe', title: 'Language', value: 'English', type: 'dropdown' },
    { icon: 'moon', title: 'Dark Mode', type: 'switch' },
    { icon: 'bellOff', title: 'Mute Notification', type: 'switch' },
    { icon: 'bell', title: 'Custom Notification', type: 'navigate' },
    { icon: 'userPlus', title: 'Invite Friends', type: 'navigate' },
    { icon: 'users', title: 'Joined Groups', type: 'navigate' },
    { icon: 'eye', title: 'Hide Chat History', type: 'switch' },
    { icon: 'lock', title: 'Security', type: 'navigate', onPress: () => navigation.navigate('Security') },
    { icon: 'file', title: 'Term of Service', type: 'navigate', onPress: () => navigation.navigate('Terms', { title: 'Term of Service' }) },
    { icon: 'help', title: 'About App', type: 'navigate', onPress: () => navigation.navigate('Terms', { title: 'About App' }) },
    { icon: 'help', title: 'Help Center', type: 'navigate' },
    { icon: 'logout', title: 'Logout', type: 'danger', onPress: logout },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { backgroundColor: '#6C4DF6' }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backWrap} activeOpacity={0.8}>
            <Icon name="chat" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>E-Chat</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {}} activeOpacity={0.8}>
              <Icon name="search" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {}} activeOpacity={0.8}>
              <Text style={styles.actionIcon}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.list}>
        {menuItems.map((item, index) => {
          const isLast = index === menuItems.length - 1;
          return (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.row,
                (rowBase as any),
                item.type === 'danger' && { backgroundColor: '#FFFFFF' },
                !isLast && { borderBottomWidth: 1, borderBottomColor: '#E6E2F5' },
              ]}
              activeOpacity={0.85}
              onPress={
                item.type === 'danger'
                  ? item.onPress
                  : item.type === 'navigate' && item.onPress
                    ? item.onPress
                    : () => {}
              }
            >
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Icon name={item.icon as IconName} size={22} color={item.type === 'danger' ? '#E5484D' : '#1B1730'} />
                </View>
                <Text style={[styles.rowTitle, { color: item.type === 'danger' ? '#E5484D' : '#1B1730' }]}>
                  {item.title}
                </Text>
              </View>
              <View style={styles.rowRight}>
                {item.type === 'switch' && item.title === 'Dark Mode' ? (
                  <Switch
                    value={darkMode}
                    onValueChange={setDarkMode}
                    trackColor={{ false: '#E6E2F5', true: '#6C4DF6' }}
                  />
                ) : item.type === 'switch' && item.title === 'Mute Notification' ? (
                  <Switch
                    value={false}
                    onValueChange={() => {}}
                    trackColor={{ false: '#E6E2F5', true: '#6C4DF6' }}
                  />
                ) : item.type === 'switch' && item.title === 'Hide Chat History' ? (
                  <Switch
                    value={false}
                    onValueChange={() => {}}
                    trackColor={{ false: '#E6E2F5', true: '#6C4DF6' }}
                  />
                ) : item.type === 'dropdown' ? (
                  <>
                    <Text style={[styles.rowValue, { color: '#5E5A78' }]}>{item.value}</Text>
                    <Icon name="chevronDown" size={18} color="#8A86A3" />
                  </>
                ) : (
                  <Icon name="chevronRight" size={18} color="#8A86A3" />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 54,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 24,
    borderBottomLeftRadius: BorderRadius.card,
    borderBottomRightRadius: BorderRadius.card,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backWrap: { padding: 8 },
  backIcon: { fontSize: 28 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    gap: 14,
  },
  actionBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
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
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 14,
    marginRight: 8,
  },
  rowArrow: {
    fontSize: 16,
  },
});
