import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet, ActivityIndicator, Image, KeyboardAvoidingView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useAppColors } from '../theme/useAppColors';
import * as api from '../services/api';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { resolveUrl } from '../config';
import { PROFILE, startText } from '../theme/profileLayout';

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=60';

export default function ProfileEditScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState((user as any)?.bio || '');
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar ?? undefined);
  const [uploading, setUploading] = useState(false);
  const [cover, setCover] = useState<string | undefined>((user as any)?.cover_image ?? undefined);
  const [coverBusy, setCoverBusy] = useState(false);

  const pickCover = async () => {
    if (coverBusy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Please allow photo access to change your cover.');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [390, PROFILE.bannerHeight], quality: 0.8 });
      if (res.canceled) return;
      setCoverBusy(true);
      const fd = new FormData();
      fd.append('cover', { uri: res.assets[0].uri, type: 'image/jpeg', name: 'cover.jpg' } as any);
      const r = await api.users.updateCover(fd);
      const url = r.data?.cover_image;
      if (!url) throw new Error('no url');
      setCover(url);
      updateUser({ cover_image: url } as any);
    } catch {
      Alert.alert('Error', 'Failed to update cover');
    } finally {
      setCoverBusy(false);
    }
  };

  const removeCover = async () => {
    if (coverBusy) return;
    setCoverBusy(true);
    try {
      await api.users.removeCover();
      setCover(undefined);
      updateUser({ cover_image: null } as any);
    } catch {
      Alert.alert('Error', 'Could not remove the cover');
    } finally {
      setCoverBusy(false);
    }
  };

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Please allow photo access to change your picture.');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (res.canceled) return;
      setUploading(true);
      const fd = new FormData();
      fd.append('avatar', { uri: res.assets[0].uri, type: 'image/jpeg', name: 'avatar.jpg' } as any);
      const r = await api.users.updateAvatar(fd);
      setAvatar(r.data?.avatar || res.assets[0].uri);
      updateUser({ avatar: r.data?.avatar });
    } catch {
      Alert.alert('Error', 'Failed to update image');
    } finally {
      setUploading(false);
    }
  };

  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.users.updateMe({ name: name.trim() || user?.name, bio });
      updateUser({ ...res.data, avatar: avatar ?? res.data.avatar });
      nav.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value, onChange, multiline }: { label: string; value: string; onChange: (t: string) => void; multiline?: boolean }) => (
    <View style={[styles.field, { borderColor: c.inputBorder, backgroundColor: c.card }]}>
      <Text style={[{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }, startText()]}>{label}</Text>
      <TextInput
        value={value}
        accessibilityLabel={label}
        onChangeText={onChange}
        multiline={multiline}
        style={[{ color: c.text, fontSize: 17, paddingVertical: 4, minHeight: multiline ? 70 : undefined, textAlignVertical: multiline ? 'top' : 'center' }, startText()]}
        placeholderTextColor={c.placeholder}
        maxLength={multiline ? 160 : 50}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: c.background }]} behavior="padding">
      <ScreenHeader title="Edit profile" onBack={() => nav.goBack()} rightText="Save" onRightPress={save} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24, gap: 14 }}>
        <View>
          <TouchableOpacity onPress={pickCover} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Change cover photo" accessibilityState={{ disabled: coverBusy, busy: coverBusy }}>
            <Image source={{ uri: resolveUrl(cover) || DEFAULT_BANNER }} style={styles.cover} />
            <View style={styles.coverShade}>
              {coverBusy ? <ActivityIndicator color="#FFFFFF" /> : (
                <View style={styles.coverPill}><Icon name="camera" size={16} color="#FFFFFF" /><Text style={styles.coverPillText}>Change cover</Text></View>
              )}
            </View>
          </TouchableOpacity>
          {cover ? (
            <TouchableOpacity onPress={removeCover} disabled={coverBusy} style={styles.coverRemove} accessibilityRole="button" accessibilityLabel="Remove cover photo">
              <Icon name="trash" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={pick} activeOpacity={0.8} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="Change profile photo" accessibilityState={{ disabled: uploading, busy: uploading }}>
            <View style={[styles.avatarRing, { borderColor: c.background, backgroundColor: c.background }]}>
              <Avatar source={avatar} name={name} size={PROFILE.avatar} />
              <View style={[styles.cam, { backgroundColor: c.primary, borderColor: c.background }]}>
                {uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="camera" size={14} color="#FFFFFF" />}
              </View>
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 14, marginTop: -PROFILE.avatarOverlap + 8 }}>
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Bio" value={bio} onChange={setBio} multiline />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  field: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, gap: 5 },
  cover: { width: '100%', height: PROFILE.bannerHeight, backgroundColor: '#252B45' },
  coverShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  coverPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, paddingHorizontal: 14, height: 34 },
  coverPillText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  coverRemove: { position: 'absolute', top: 12, end: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  avatarWrap: { position: 'absolute', start: PROFILE.padX, bottom: PROFILE.avatarOverlap },
  avatarRing: { borderWidth: 4, borderRadius: 32 },
  cam: { position: 'absolute', end: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
