import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Image, TouchableOpacity, ScrollView, StatusBar, StyleSheet, useWindowDimensions, ActivityIndicator, Text, Platform,
  TextInput, Keyboard, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { ReactionButton, ReactionState } from './ReactionButton';

export interface ViewerActions {
  reaction: ReactionState;
  onReact: (emoji: string) => void;
  comments: number;
  /** resolves when the comment was saved */
  onSendComment: (text: string) => Promise<void>;
  /** opens the full thread (closes the viewer first) */
  onOpenComments?: () => void;
}

interface Props {
  /** single image */
  uri?: string | null;
  /** or a gallery (swipe left/right) */
  uris?: string[];
  initialIndex?: number;
  onClose: () => void;
  actions?: ViewerActions;
}

const ZOOM = 2.5;

/**
 * Full-screen image viewer.
 * - iOS: pinch to zoom (native ScrollView zoom) and double tap.
 * - Android: double tap toggles a 2.5x zoom you can pan around.
 * Close with the X, the hardware back button or a tap on the picture.
 */
export const ImageViewer = ({ uri: single, uris, initialIndex = 0, onClose, actions }: Props) => {
  const list = uris && uris.length ? uris : single ? [single] : [];
  const [index, setIndex] = useState(initialIndex);
  const uri: string | null = list[index] || null;
  const pager = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [zoomed, setZoomed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending || !actions) return;
    setSending(true);
    try {
      await actions.onSendComment(t);
      setText('');
      setSent(true);
      Keyboard.dismiss();
      setTimeout(() => setSent(false), 1800);
    } catch {
      Alert.alert('Error', 'Could not send your comment.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { setZoomed(false); setLoading(true); setFailed(false); }, [uri]);
  useEffect(() => { setIndex(initialIndex); }, [initialIndex, single, uris]);

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap < 280) { setZoomed((z) => !z); setLastTap(0); } else setLastTap(now);
  };

  const w = zoomed ? width * ZOOM : width;
  const h = zoomed ? height * ZOOM : height;

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden={Platform.OS === 'ios'} backgroundColor="#000" barStyle="light-content" />
      <View style={styles.root}>
        {uri ? (
          <ScrollView
            key={zoomed ? 'z' : 'n'}
            style={StyleSheet.absoluteFill}
            contentContainerStyle={{ width: Math.max(w, width), height: Math.max(h, height), alignItems: 'center', justifyContent: 'center' }}
            horizontal={zoomed}
            // iOS native pinch
            maximumZoomScale={Platform.OS === 'ios' ? 4 : 1}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {zoomed ? (
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ width: w, height: h }}>
                <TouchableOpacity activeOpacity={1} onPress={onTap}>
                  <Image source={{ uri }} style={{ width: w, height: h }} resizeMode="contain" />
                </TouchableOpacity>
              </ScrollView>
            ) : null}
            {!zoomed ? (
              <ScrollView
                ref={pager}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={{ width, height }}
                onLayout={() => pager.current?.scrollTo({ x: index * width, animated: false })}
                onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
                scrollEnabled={list.length > 1}
              >
                {list.map((u, i) => (
                  <TouchableOpacity key={u + i} activeOpacity={1} onPress={onTap} style={{ width, height }}>
                    <Image
                      source={{ uri: u }}
                      style={{ width, height }}
                      resizeMode="contain"
                      onLoadEnd={() => { if (i === index) setLoading(false); }}
                      onError={() => { if (i === index) { setFailed(true); setLoading(false); } }}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
          </ScrollView>
        ) : null}
        {list.length > 1 ? (
          <View style={[styles.counter, { top: insets.top + 20 }]} pointerEvents="none">
            <Text style={styles.counterText}>{index + 1} / {list.length}</Text>
          </View>
        ) : null}
        {loading && !failed ? <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" size="large" pointerEvents="none" /> : null}
        {failed ? <Text style={styles.error}>Could not load the image</Text> : null}
        {actions ? (
          <View style={[styles.bar, { bottom: kb > 0 ? kb + 8 : insets.bottom + 8 }]}>
            {sent ? <Text style={styles.sent}>Comment sent</Text> : null}
            <View style={styles.counts}>
              <ReactionButton state={actions.reaction} onReact={actions.onReact} color="#FFFFFF" likedColor="#FF4D79" size={26} textStyle={styles.countText} />
              <TouchableOpacity style={styles.count} onPress={actions.onOpenComments} disabled={!actions.onOpenComments} hitSlop={8} activeOpacity={0.7}>
                <Icon name="messageCircle" size={26} color="#FFFFFF" />
                <Text style={styles.countText}>{actions.comments}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Add a comment..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={styles.input}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={submit}
              />
              <TouchableOpacity onPress={submit} disabled={!text.trim() || sending} style={{ opacity: text.trim() && !sending ? 1 : 0.4 }} hitSlop={8}>
                {sending ? <ActivityIndicator color="#fff" /> : <Icon name="sendFeather" size={22} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        <TouchableOpacity style={[styles.close, { top: insets.top + 12 }]} onPress={onClose} hitSlop={12} activeOpacity={0.8}>
          <Icon name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
  counts: { flexDirection: 'row', gap: 26, marginBottom: 10 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, height: 44 },
  input: { flex: 1, color: '#fff', fontSize: 15, padding: 0 },
  sent: { color: '#fff', fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  counter: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)' },
  counterText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  error: { position: 'absolute', alignSelf: 'center', top: '50%', color: '#fff' },
});

export default ImageViewer;
