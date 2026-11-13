import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useAppColors } from '../theme/useAppColors';
import * as api from '../services/api';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';

export default function ProfileEditScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState((user as any)?.bio || '');
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar);
  const [uploading, setUploading] = useState(false);

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
    <View style={[styles.field, { borderColor: c.inputBorder }]}>
      <Text style={{ color: c.textSecondary, fontSize: 13 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={{ color: c.text, fontSize: 17, paddingVertical: 4, minHeight: multiline ? 70 : undefined, textAlignVertical: multiline ? 'top' : 'center' }}
        placeholderTextColor={c.placeholder}
        maxLength={multiline ? 160 : 50}
      />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader title="Edit profile" onBack={() => nav.goBack()} rightText="Save" onRightPress={save} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
        <TouchableOpacity onPress={pick} activeOpacity={0.8} style={{ alignSelf: 'center' }}>
          <Avatar source={avatar} name={name} size={96} />
          <View style={styles.cam}>
            {uploading ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="camera" size={22} color="#FFFFFF" />}
          </View>
        </TouchableOpacity>
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Bio" value={bio} onChange={setBio} multiline />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  field: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  cam: { ...StyleSheet.absoluteFill, borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
});
