import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Alert, StatusBar, StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAppColors } from '../theme/useAppColors';
import { AuthHeader } from '../components/AuthHeader';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { Icon } from '../components/Icon';

/** Design: "Sign Up _ User Informarion Empty / Typing / Filled" (name + avatar). */
export default function UserInfoScreen() {
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { login } = useAuth();
  const { c, isDark } = useAppColors();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) setAvatar(res.assets[0].uri);
  };

  const finish = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    let avatarUrl: string | undefined;
    try {
      if (avatar) {
        const fd = new FormData();
        fd.append('avatar', { uri: avatar, name: 'avatar.jpg', type: 'image/jpeg' } as any);
        const r = await api.users.updateAvatar(fd);
        avatarUrl = r.data?.avatar || r.data?.url;
      }
    } catch {
      Alert.alert('Notice', 'Could not upload the photo now. You can change it later from your profile.');
    }
    const token: string | undefined = route.params?.token;
    const user = { ...(route.params?.user || {}), name: trimmed, phone: route.params?.phone, ...(avatarUrl ? { avatar: avatarUrl } : {}) };
    setLoading(false);
    if (token) await login(token, user);
    else navigation.popToTop();
  };

  const underline = focused ? c.primary : c.text;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AuthHeader
        title="Register"
        subtitle=""
        backLabel="Login"
        onBack={() => navigation.navigate('Login')}
        variant="curve"
        height={focused ? 300 : 360}
      >
        <View style={styles.avatarWrap}>
          <TouchableOpacity onPress={pick} activeOpacity={0.85} style={[styles.avatar, { backgroundColor: c.primary }]}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <Icon name="user" size={64} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={pick} style={styles.pen} activeOpacity={0.85}>
            <Icon name="pen" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </AuthHeader>

      <View style={styles.body}>
        <View style={[styles.field, { borderBottomColor: underline }]}>
          <Icon name="user" size={22} color={c.text} />
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Your Name"
            placeholderTextColor={c.textSecondary}
            style={[styles.input, { color: c.text }]}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.btn}>
          <RoundArrowButton onPress={finish} disabled={!name.trim()} loading={loading} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarWrap: { position: 'absolute', alignSelf: 'center', top: 118 },
  avatar: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  pen: {
    position: 'absolute', right: -2, top: 2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#6C4DF6', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  body: { paddingHorizontal: 24, marginTop: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 2, paddingBottom: 10 },
  input: { flex: 1, fontSize: 20, padding: 0 },
  btn: { alignItems: 'flex-end', marginTop: 24 },
});
