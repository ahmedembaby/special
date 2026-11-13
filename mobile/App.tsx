import React from 'react';
import 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme, DarkTheme, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useThemeSettings } from './src/context/ThemeContext';
import { AppLockProvider, useAppLock } from './src/context/AppLockContext';
import { CallProvider } from './src/context/CallContext';
import LockScreen from './src/components/LockScreen';
import { Colors } from './src/theme';
import { Icon, IconName } from './src/components/Icon';
import { QueryProvider } from './src/providers/QueryProvider';
import { OfflineIndicator } from './src/components/OfflineIndicator';

import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import OTPScreen from './src/screens/OTPScreen';
import NameEntryScreen from './src/screens/NameEntryScreen';
import UserInfoScreen from './src/screens/UserInfoScreen';
import ContactScreen from './src/screens/ContactScreen';

import HomeScreen from './src/screens/HomeScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import ComposeScreen from './src/screens/ComposeScreen';
import SearchScreen from './src/screens/SearchScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatScreen from './src/screens/ChatScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ProfileEditScreen from './src/screens/ProfileEditScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import PINSecurityScreen from './src/screens/PINSecurityScreen';
import FaceIDScreen from './src/screens/FaceIDScreen';
import TouchIDScreen from './src/screens/TouchIDScreen';
import TermsScreen from './src/screens/TermsScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import AdminDashboard from './src/screens/AdminDashboard';
import KeyBackupScreen from './src/screens/KeyBackupScreen';
import PrivacySettingsScreen from './src/screens/PrivacySettingsScreen';
import StarredScreen from './src/screens/StarredScreen';
import GlobalSearchScreen from './src/screens/GlobalSearchScreen';
import { I18nProvider, useI18n } from './src/i18n';
import BlockedUsersScreen from './src/screens/BlockedUsersScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import HashtagScreen from './src/screens/HashtagScreen';
import GroupInvitesScreen from './src/screens/GroupInvitesScreen';
import SessionsScreen from './src/screens/SessionsScreen';
import { onSocket } from './src/services/socket';

const AuthStack = createStackNavigator();
const RootStack = createStackNavigator();
const HomeStack = createStackNavigator();
const MessagesStack = createStackNavigator();
const ProfileStack = createStackNavigator();
const Tabs = createBottomTabNavigator();

const mkTheme = (base: typeof DefaultTheme, c: typeof Colors.light) => ({
  ...base,
  colors: { ...base.colors, background: c.background, card: c.background, text: c.text, border: c.border, primary: c.primary },
});
const LightNavTheme = mkTheme(DefaultTheme, Colors.light);
const DarkNavTheme = mkTheme(DarkTheme, Colors.dark);

const noHeader = { headerShown: false };

const HomeStackScreen = () => (
  <HomeStack.Navigator screenOptions={noHeader}>
    <HomeStack.Screen name="Feed" component={HomeScreen} />
    <HomeStack.Screen name="PostDetail" component={PostDetailScreen} />
  </HomeStack.Navigator>
);

const MessagesStackScreen = () => (
  <MessagesStack.Navigator screenOptions={noHeader}>
    <MessagesStack.Screen name="ChatsList" component={ChatsScreen} />
    <MessagesStack.Screen name="Chat" component={ChatScreen} />
    <MessagesStack.Screen name="GroupChat" component={GroupChatScreen} />
    <MessagesStack.Screen name="ContactScreen" component={ContactScreen} />
  </MessagesStack.Navigator>
);

const ProfileStackScreen = () => (
  <ProfileStack.Navigator screenOptions={noHeader}>
    <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
    <ProfileStack.Screen name="ProfileEdit" component={ProfileEditScreen} />
    <ProfileStack.Screen name="Settings" component={SettingsScreen} />
    <ProfileStack.Screen name="Security" component={SecurityScreen} />
    <ProfileStack.Screen name="Sessions" component={SessionsScreen} />
    <ProfileStack.Screen name="PINSecurity" component={PINSecurityScreen} />
    <ProfileStack.Screen name="FaceID" component={FaceIDScreen} />
    <ProfileStack.Screen name="TouchID" component={TouchIDScreen} />
    <ProfileStack.Screen name="Terms" component={TermsScreen} />
    <ProfileStack.Screen name="AdminDashboard" component={AdminDashboard} />
  </ProfileStack.Navigator>
);

const TAB_ICONS: Record<string, [IconName, IconName]> = {
  Home: ['home', 'homeFill'],
  Search: ['search', 'search'],
  Notifications: ['bell', 'bellFill'],
  Messages: ['mail', 'mailFill'],
  Groups: ['users', 'usersFill'],
  Profile: ['user', 'userFill'],
};

// screens inside a tab that should hide the tab bar (full-screen chat UIs)
const HIDE_TABBAR = ['Chat', 'GroupChat', 'ContactScreen', 'PostDetail', 'ProfileEdit', 'Settings', 'PrivacySettings', 'Security', 'Sessions', 'PINSecurity', 'FaceID', 'TouchID', 'Terms', 'AdminDashboard', 'GroupDetail', 'GroupMembers', 'GroupSettings'];

const MainTabs = () => {
  const { darkMode } = useThemeSettings();
  const { t } = useI18n();
  const c = darkMode ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => {
        const focused = getFocusedRouteNameFromRoute(route) ?? '';
        const hide = HIDE_TABBAR.includes(focused);
        return {
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.textMuted,
          tabBarIconStyle: { width: 68, height: 50 },
          tabBarStyle: {
            display: hide ? 'none' : 'flex',
            backgroundColor: c.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: c.border,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            height: 68 + insets.bottom,
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom, 6),
            shadowColor: '#000',
            shadowOpacity: darkMode ? 0.5 : 0.1,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: -4 },
            elevation: 12,
          },
          tabBarIcon: ({ focused: f, color }: { focused: boolean; color: string }) => {
            const [off, on] = TAB_ICONS[route.name];
            const label = t(route.name === 'Messages' ? 'Messages' : route.name);
            return (
              <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 48, gap: 3 }}>
                <View style={{ width: 38, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: f ? c.primaryLight : 'transparent' }}>
                  <Icon name={f ? on : off} size={21} color={color} strokeWidth={f ? 2.2 : 1.75} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: 10, lineHeight: 13, fontWeight: f ? '700' : '500', color }}>{label}</Text>
              </View>
            );
          },
        };
      }}
    >
      <Tabs.Screen name="Home" component={HomeStackScreen} />
      <Tabs.Screen name="Search" component={SearchScreen} options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} />
      <Tabs.Screen name="Messages" component={MessagesStackScreen} options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="Groups" component={GroupsScreen} />
      <Tabs.Screen name="Profile" component={ProfileStackScreen} />
    </Tabs.Navigator>
  );
};

function RootNavigator() {
  const { token, loading } = useAuth();
  const { locked, ready } = useAppLock();
  const { darkMode } = useThemeSettings();
  const c = darkMode ? Colors.dark : Colors.light;

  React.useEffect(() => {
    if (!token) return undefined;
    ScreenCapture.preventScreenCaptureAsync('special-private-app').catch(() => {});
    if (Platform.OS === 'ios') ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync('special-private-app').catch(() => {});
      if (Platform.OS === 'ios') ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
    };
  }, [token]);
  React.useEffect(() => onSocket('security_key_changed', (event: { userName?: string }) => {
    Alert.alert('Encryption key changed', (event.userName || 'A contact') + ' changed their encryption key. Open the conversation and compare the updated 60-digit safety number with them before trusting it.');
  }), []);

  if (loading || !ready) {
    return (
      <View style={[styles.splash, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={darkMode ? DarkNavTheme : LightNavTheme}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      {token ? (
        <RootStack.Navigator screenOptions={noHeader}>
          <RootStack.Screen name="Main" component={MainTabs} />
          <RootStack.Screen name="UserProfile" component={UserProfileScreen} />
          <RootStack.Screen name="Hashtag" component={HashtagScreen} />
          <RootStack.Screen name="KeyBackup" component={KeyBackupScreen} />
          <RootStack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
          <RootStack.Screen name="Starred" component={StarredScreen} />
          <RootStack.Screen name="GlobalSearch" component={GlobalSearchScreen} />
          <RootStack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
          <RootStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
          <RootStack.Screen name="GroupInvites" component={GroupInvitesScreen} />
          <RootStack.Screen name="Compose" component={ComposeScreen} options={{ presentation: 'modal' }} />
        </RootStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={noHeader}>
          <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="OTP" component={OTPScreen} />
          <AuthStack.Screen name="NameEntryScreen" component={NameEntryScreen} />
          <AuthStack.Screen name="UserInfo" component={UserInfoScreen} />
        </AuthStack.Navigator>
      )}
      <OfflineIndicator />
      {locked ? <LockScreen /> : null}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ThemeProvider>
         <I18nProvider>
          <AuthProvider>
            <AppLockProvider>
              <CallProvider>
                <RootNavigator />
              </CallProvider>
            </AppLockProvider>
          </AuthProvider>
         </I18nProvider>
        </ThemeProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
