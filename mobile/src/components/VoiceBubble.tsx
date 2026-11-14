import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, GestureResponderEvent } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from './Icon';

const BARS = 34;
const RATES = [1, 1.5, 2];

// ids of received voice messages already listened to (kept on this device)
let played: Set<string> | null = null;
const loadPlayed = async () => {
  if (played) return played;
  try { played = new Set(JSON.parse((await AsyncStorage.getItem('played_voice')) || '[]')); } catch { played = new Set(); }
  return played;
};
const markPlayed = async (id: string) => {
  const set = await loadPlayed();
  if (set.has(id)) return;
  set.add(id);
  AsyncStorage.setItem('played_voice', JSON.stringify([...set].slice(-500))).catch(() => {});
};

// only one voice message plays at a time
let current: { token: object; pause: () => void } | null = null;

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const parseLabel = (s?: string) => {
  const m = /^(\d+):(\d{2})$/.exec(s || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

/** Deterministic pseudo waveform so every message keeps its own shape. */
const makeBars = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) + i;
    const r = ((h >>> 0) % 1000) / 1000;
    out.push(0.25 + 0.75 * Math.abs(Math.sin(i * 0.55 + r * 2.2)) * (0.55 + 0.45 * r));
  }
  return out;
};

interface Props {
  uri: string;
  /** "0:07" from the server (used until the real duration is known) */
  durationLabel?: string;
  isOwn?: boolean;
  seed?: string;
  /** 34 digits 0-9 recorded by the sender (real loudness); falls back to a pseudo waveform */
  waveform?: string | null;
  /** received messages show a dot until they were listened to */
  messageId?: string;
  /** own-bubble color chosen in the chat theme */
  accent?: string | null;
}

/** Voice message player: play/pause, waveform with progress + tap-to-seek, elapsed time, 1x/1.5x/2x speed. */
export const VoiceBubble = ({ uri, durationLabel, isOwn, seed, waveform, messageId, accent }: Props) => {
  const { c } = useAppColors();
  const playerRef = useRef<any>(null);
  const token = useRef({}).current;
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(parseLabel(durationLabel));
  const [rateIdx, setRateIdx] = useState(0);
  const [width, setWidth] = useState(0);
  const bars = useMemo(() => {
    if (waveform && /^[0-9]{10,64}$/.test(waveform)) {
      const d = waveform.split('').map((x) => Number(x) / 9);
      return Array.from({ length: BARS }, (_, i) => d[Math.min(d.length - 1, Math.floor((i * d.length) / BARS))]);
    }
    return makeBars(seed || uri);
  }, [waveform, seed, uri]);
  const [heard, setHeard] = useState(true);
  useEffect(() => {
    if (isOwn || !messageId) return;
    loadPlayed().then((set) => setHeard(set.has(messageId)));
  }, [isOwn, messageId]);

  const fg = isOwn ? '#FFFFFF' : c.primary;
  const dim = isOwn ? 'rgba(255,255,255,0.4)' : c.border;
  const text = isOwn ? 'rgba(255,255,255,0.9)' : c.textSecondary;

  useEffect(() => () => {
    if (current && current.token === token) current = null;
    try { playerRef.current?.remove?.(); } catch { /* already released */ }
    playerRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pauseSelf = () => { try { playerRef.current?.pause(); } catch { /* ignore */ } setPlaying(false); };

  const ensure = async () => {
    if (playerRef.current) return playerRef.current;
    const { createAudioPlayer, setAudioModeAsync } = await import('expo-audio');
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const p = createAudioPlayer({ uri });
    p.addListener('playbackStatusUpdate', (st: any) => {
      setPlaying(!!st.playing);
      setPos(st.currentTime || 0);
      if (st.duration) setDur(st.duration);
      if (st.didJustFinish) {
        setPlaying(false);
        setPos(0);
        Promise.resolve(p.seekTo(0)).catch(() => {});
      }
    });
    playerRef.current = p;
    return p;
  };

  const toggle = async () => {
    try {
      const p = await ensure();
      if (playing) { p.pause(); return; }
      if (current && current.token !== token) current.pause();
      current = { token, pause: pauseSelf };
      try { p.setPlaybackRate?.(RATES[rateIdx]); } catch { /* ignore */ }
      p.play();
      if (!isOwn && messageId) { markPlayed(messageId); setHeard(true); }
    } catch { /* could not load the audio */ }
  };

  const cycleRate = async () => {
    const next = (rateIdx + 1) % RATES.length;
    setRateIdx(next);
    try { playerRef.current?.setPlaybackRate?.(RATES[next]); } catch { /* ignore */ }
  };

  const seek = async (e: GestureResponderEvent) => {
    if (!width || !dur) return;
    const frac = Math.max(0, Math.min(1, e.nativeEvent.locationX / width));
    try { const p = await ensure(); await p.seekTo(frac * dur); setPos(frac * dur); } catch { /* ignore */ }
  };

  const progress = dur > 0 ? pos / dur : 0;

  return (
    <View style={[styles.wrap, { backgroundColor: isOwn ? (accent || c.primary) : c.card }]}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={[styles.play, { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : c.primaryLight }]}>
        <Text style={{ color: fg, fontSize: 15, marginLeft: playing ? 0 : 2 }}>{playing ? '❚❚' : '▶'}</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <TouchableOpacity activeOpacity={1} onPress={seek} style={styles.bars} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {bars.map((h, i) => (
            <View key={i} style={[styles.bar, { height: 4 + h * 22, backgroundColor: i / BARS < progress ? fg : dim }]} pointerEvents="none" />
          ))}
        </TouchableOpacity>
        <View style={styles.meta}>
          <Text style={[styles.time, { color: text }]}>{playing || pos > 0 ? fmt(pos) : fmt(dur)}</Text>
          {!heard ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
        </View>
      </View>
      <TouchableOpacity onPress={cycleRate} hitSlop={8} style={[styles.rate, { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : c.inputBg }]}>
        <Text style={{ color: fg, fontSize: 11, fontWeight: '800' }}>{RATES[rateIdx]}x</Text>
      </TouchableOpacity>
    </View>
  );
};

/** Pulsing red dot for the recording bar. */
export const RecordingDot = ({ color }: { color: string }) => {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, opacity: a, marginRight: 8 }} />;
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 19, minWidth: 246, maxWidth: 310, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(110,120,150,0.16)' },
  play: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 32 },
  bar: { width: 3, borderRadius: 2 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  time: { fontSize: 11, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'center' },
  rate: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(110,120,150,0.18)' },
});
