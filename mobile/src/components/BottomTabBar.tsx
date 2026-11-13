import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../theme';
import { useAppColors } from '../theme/useAppColors';
import { useI18n } from '../i18n';
import { Icon, IconName } from './Icon';

interface TabRoute { name: string; icon: IconName; activeIcon: IconName; key: string; label: string; }
const tabs: TabRoute[] = [
  { name: 'Chats', key: 'Chats', label: 'Messages', icon: 'chat', activeIcon: 'chat' },
  { name: 'Groups', key: 'Groups', label: 'Groups', icon: 'users', activeIcon: 'usersFill' },
  { name: 'Profile', key: 'Profile', label: 'Profile', icon: 'user', activeIcon: 'userFill' },
  { name: 'More', key: 'More', label: 'More', icon: 'menu', activeIcon: 'settings' },
];

interface BottomTabBarProps {
  state: { routes: Array<{ key: string; name: string }>; index: number };
  navigation: { navigate: (name: string) => void };
}

export const BottomTabBar = ({ state, navigation }: BottomTabBarProps) => {
  const { c } = useAppColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, {
      backgroundColor: c.tabBg,
      borderTopColor: c.border,
      paddingBottom: Math.max(insets.bottom, 8),
    }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const tab = tabs.find((item) => item.key === route.name) || tabs[index];
        if (!tab) return null;
        const color = focused ? c.tabActive : c.tabInactive;
        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t(tab.label)}
            style={styles.tab}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconWrap, focused && { backgroundColor: c.primaryLight }]}>
              <Icon name={focused ? tab.activeIcon : tab.icon} size={21} color={color} strokeWidth={focused ? 2.1 : 1.7} />
            </View>
            <Text style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}>{t(tab.label)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    minHeight: 68,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  iconWrap: { width: 38, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { ...Typography.tab, fontSize: 11, letterSpacing: 0.1 },
});
