import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
import { Icon, IconName } from './Icon';

const { width } = Dimensions.get('window');
const TAB_WIDTH = width / 4;

interface TabRoute {
  name: string;
  icon: IconName;
  key: string;
}

const tabs: TabRoute[] = [
  { name: 'Chats', icon: 'chat', key: 'Chats' },
  { name: 'Groups', icon: 'users', key: 'Groups' },
  { name: 'Profile', icon: 'user', key: 'Profile' },
  { name: 'More', icon: 'menu', key: 'More' },
];

interface BottomTabBarProps {
  state: { routes: Array<{ key: string; name: string }>; index: number };
  navigation: { navigate: (name: string) => void };
}

export const BottomTabBar = ({ state, navigation }: BottomTabBarProps) => {
  const { c } = useAppColors();

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF', borderTopColor: '#E6E2F5' }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const tab = tabs.find((t) => t.key === route.key) || tabs[index];
        const Color = isFocused ? '#6C4DF6' : '#5E5A78';

        return (
          <TouchableOpacity
            key={route.key}
            style={[styles.tab, isFocused && styles.activeTab]}
            onPress={() => {
              navigation.navigate(route.name);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.iconWrap}>
              <Icon name={tab.icon} size={22} color={Color} />
            </View>
            <Text style={[styles.label, { color: Color, fontWeight: isFocused ? '600' : '400' }]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 90,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E6E2F5',
  },
  tab: {
    width: TAB_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  activeTab: {},
  iconWrap: {
    marginBottom: 4,
  },
  label: {
    ...Typography.tab,
    textAlign: 'center',
  },
});
