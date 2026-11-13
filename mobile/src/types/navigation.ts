import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  OTP: { phone: string; display?: string; mode?: 'register' | 'login'; remember?: boolean };
  UserInfo: { phone: string; token?: string; user?: Record<string, unknown> };
  Root: undefined;
  Chat: { conversationId: string | number; conversationName?: string; conversationAvatar?: string; conversationPhone?: string; currentUserId?: string };
  Profile: undefined;
  GroupChat: undefined;
  ContactScreen: undefined;
  Settings: undefined;
};

export type RootTabParamList = {
  Chats: undefined;
  Groups: undefined;
  Profile: undefined;
  More: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ProfileEdit: undefined;
  Settings: undefined;
  Security: undefined;
  PINSecurity: undefined;
  FaceID: undefined;
  TouchID: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Settings: undefined;
  Security: undefined;
  PINSecurity: undefined;
  FaceID: undefined;
  TouchID: undefined;
  Terms: { title?: string } | undefined;
};

export type ChatStackParamList = {
  ChatsList: undefined;
  Chat: RootStackParamList['Chat'];
  GroupChat: undefined;
};

export type AppNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList>,
  StackNavigationProp<RootStackParamList>
>;
