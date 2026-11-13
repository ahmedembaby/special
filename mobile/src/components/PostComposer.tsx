import { useState } from 'react';
import { MentionSuggest } from './MentionSuggest';
import { View, Text, TextInput, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppColors } from '../theme/useAppColors';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Me, MAX_POST_IMAGES } from '../services/social';

const MAX = 280;

interface Props {
  me: Me;
  onPost: (content: string, images: string[], extras?: { pollOptions?: string[] }) => Promise<void>;
  /** quoted post shown under the text */
  quote?: { content?: string; user?: { name: string; username: string } } | null;
  autoFocus?: boolean;
  placeholder?: string;
  buttonLabel?: string;
  allowImage?: boolean;
}

export const PostComposer = ({ me, onPost, quote, autoFocus, placeholder = "What's happening?", buttonLabel = 'Post', allowImage = true }: Props) => {
  const { c } = useAppColors();
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [poll, setPoll] = useState<string[] | null>(null);
  const pollOptions = (poll || []).map((o) => o.trim()).filter(Boolean);
  const pollValid = !poll || pollOptions.length >= 2;
  const [busy, setBusy] = useState(false);
  const can = (text.trim().length > 0 || images.length > 0 || !!quote) && pollValid && !busy;
  const room = MAX_POST_IMAGES - images.length;

  const pick = async (camera: boolean) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Please allow access to continue.');
      if (room <= 0) return Alert.alert('Limit reached', `You can add up to ${MAX_POST_IMAGES} photos.`);
      const opts: ImagePicker.ImagePickerOptions = camera
        ? { mediaTypes: ['images'], quality: 0.7 }
        : { mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: room, orderedSelection: true };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled) setImages((prev) => [...prev, ...res.assets.map((a) => a.uri)].slice(0, MAX_POST_IMAGES));
    } catch {
      Alert.alert('Error', 'Could not open the picker.');
    }
  };

  const submit = async () => {
    if (!can) return;
    setBusy(true);
    try {
      await onPost(text.trim(), images, poll ? { pollOptions } : undefined);
      setText('');
      setImages([]);
      setPoll(null);
    } finally {
      setBusy(false);
    }
  };

  const left = MAX - text.length;
  return (
    <View style={[styles.wrap, { backgroundColor: c.card, shadowColor: c.shadow }]}>
      <Avatar source={me.avatar} name={me.name} size={44} />
      <View style={{ flex: 1 }}>
        <TextInput
          style={[styles.input, { color: c.text }]}
          placeholder={placeholder}
          placeholderTextColor={c.placeholder}
          multiline
          value={text}
          onChangeText={setText}
          maxLength={MAX}
          autoFocus={autoFocus}
        />
        <MentionSuggest text={text} onPick={setText} />
        {poll ? (
          <View style={{ gap: 6, marginTop: 8 }}>
            {poll.map((o, i) => (
              <TextInput
                key={i}
                value={o}
                onChangeText={(v) => setPoll(poll.map((x, k) => (k === i ? v : x)))}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor={c.placeholder}
                maxLength={80}
                style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: c.text }}
              />
            ))}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {poll.length < 4 ? <TouchableOpacity onPress={() => setPoll([...poll, ''])}><Text style={{ color: c.primary, fontWeight: '700' }}>+ Add option</Text></TouchableOpacity> : null}
              <TouchableOpacity onPress={() => setPoll(null)}><Text style={{ color: c.danger, fontWeight: '700' }}>Remove poll</Text></TouchableOpacity>
            </View>
          </View>
        ) : null}
        {quote ? (
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, marginTop: 8 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>{quote.user?.name} <Text style={{ color: c.textSecondary, fontWeight: '400' }}>@{quote.user?.username}</Text></Text>
            <Text style={{ color: c.text }} numberOfLines={3}>{quote.content}</Text>
          </View>
        ) : null}
        {images.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
            {images.map((uri, i) => (
              <View key={uri + i}>
                <Image source={{ uri }} style={images.length === 1 ? styles.preview : styles.thumb} resizeMode="cover" />
                <TouchableOpacity style={styles.remove} onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}>
                  <Icon name="x" size={14} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.bar}>
          <View style={styles.tools}>
            {allowImage ? (
              <>
                <TouchableOpacity onPress={() => pick(false)} hitSlop={8}><Icon name="image" size={21} color={c.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => pick(true)} hitSlop={8}><Icon name="camera" size={21} color={c.primary} /></TouchableOpacity>
                {!quote ? <TouchableOpacity onPress={() => setPoll(poll ? null : ['', ''])} hitSlop={8}><Text style={{ fontSize: 18 }}>📊</Text></TouchableOpacity> : null}
              </>
            ) : null}
          </View>
          <View style={styles.right}>
            {text.length > 0 ? <Text style={{ color: left < 20 ? c.danger : c.textSecondary, fontSize: 13 }}>{left}</Text> : null}
            <TouchableOpacity
              onPress={submit}
              disabled={!can}
              style={[styles.btn, { backgroundColor: can ? c.primary : c.disabledBtn }]}
              activeOpacity={0.8}
            >
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnText}>{buttonLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 12, marginHorizontal: 14, marginTop: 4, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 22, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  input: { fontSize: 19, minHeight: 44, paddingTop: 8, textAlignVertical: 'top' },
  preview: { width: 260, height: 190, borderRadius: 16 },
  thumb: { width: 130, height: 130, borderRadius: 14 },
  remove: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  tools: { flexDirection: 'row', gap: 18 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: { paddingHorizontal: 18, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
