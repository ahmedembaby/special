/**
 * Voice / video calls over WebRTC. The server only relays the signalling (socket events call:*).
 * react-native-webrtc is a native module: it works in a development build (expo-dev-client / EAS), NOT in Expo Go.
 * It is required lazily so the rest of the app keeps running in Expo Go.
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert, Modal, View, Text, Image, TouchableOpacity, StyleSheet, Vibration, Platform } from 'react-native';
import api from '../services/api';
import { getSocket, onSocket } from '../services/socket';
import { resolveUrl } from '../config';
import { useAuth } from './AuthContext';

declare const require: any;
let RTC: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RTC = require('react-native-webrtc');
} catch {
  RTC = null;
}
const webrtcReady = () => !!(RTC && RTC.RTCPeerConnection && RTC.mediaDevices);

export type CallType = 'audio' | 'video';
type Phase = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active';
export interface CallPeer { id: string | number; name: string; avatar?: string | null }

interface CallApi {
  available: boolean;
  start: (peer: CallPeer, type: CallType) => Promise<void>;
}
const Ctx = createContext<CallApi>({ available: webrtcReady(), start: async () => {} });
export const useCall = () => useContext(Ctx);

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [type, setType] = useState<CallType>('audio');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const pcRef = useRef<any>(null);
  const callIdRef = useRef<number | null>(null);
  const localRef = useRef<any>(null);
  const incomingOffer = useRef<any>(null);
  const pendingLocalIce = useRef<any[]>([]);
  const pendingRemoteIce = useRef<any[]>([]);
  const remoteDescSet = useRef(false);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  const cleanup = useCallback(() => {
    Vibration.cancel();
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    try { localRef.current?.getTracks().forEach((t: any) => t.stop()); } catch { /* ignore */ }
    localRef.current = null;
    callIdRef.current = null;
    incomingOffer.current = null;
    pendingLocalIce.current = [];
    pendingRemoteIce.current = [];
    remoteDescSet.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCamOff(false);
    setSeconds(0);
    setPhase('idle');
    setPeer(null);
  }, []);

  // call timer
  useEffect(() => {
    if (phase !== 'active') return undefined;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const makePeerConnection = useCallback(async (callType: CallType) => {
    let iceServers: any[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    try { iceServers = (await api.get('/calls/ice')).data.iceServers || iceServers; } catch { /* default STUN */ }
    const stream = await RTC.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' ? { facingMode: 'user' } : false });
    localRef.current = stream;
    setLocalStream(stream);
    const pc = new RTC.RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
    pc.addEventListener('icecandidate', (e: any) => {
      if (!e.candidate) return;
      const cand = e.candidate.toJSON ? e.candidate.toJSON() : e.candidate;
      if (callIdRef.current) getSocket()?.emit('call:ice', { callId: callIdRef.current, candidate: cand });
      else pendingLocalIce.current.push(cand);
    });
    pc.addEventListener('track', (e: any) => { if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]); });
    pc.addEventListener('connectionstatechange', () => {
      const st = pc.connectionState;
      if (st === 'connected') setPhase('active');
      if ((st === 'failed' || st === 'closed') && phaseRef.current !== 'idle') hangUp();
    });
    return pc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async (p: CallPeer, callType: CallType) => {
    if (!webrtcReady()) {
      Alert.alert('Calls need a development build', 'Voice and video calls use a native module (react-native-webrtc) that is not available in Expo Go.');
      return;
    }
    if (phaseRef.current !== 'idle') return;
    setPeer(p); setType(callType); setPhase('calling');
    try {
      const pc = await makePeerConnection(callType);
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
      await pc.setLocalDescription(offer);
      const socket = getSocket();
      if (!socket) throw new Error('offline');
      socket.emit('call:invite', { to: p.id, type: callType, offer: { type: offer.type, sdp: offer.sdp } }, (res: any) => {
        if (!res || res.error) {
          cleanup();
          Alert.alert(res?.error === 'busy' ? 'Busy' : 'Call failed', res?.error === 'busy' ? `${p.name} is on another call.` : res?.error || 'Could not start the call');
          return;
        }
        callIdRef.current = res.callId;
        pendingLocalIce.current.splice(0).forEach((c) => socket.emit('call:ice', { callId: res.callId, candidate: c }));
      });
    } catch (e: any) {
      cleanup();
      Alert.alert('Call failed', 'Could not access the microphone/camera or the network.');
    }
  }, [cleanup, makePeerConnection]);

  const hangUp = useCallback(() => {
    if (callIdRef.current) getSocket()?.emit('call:end', { callId: callIdRef.current });
    cleanup();
  }, [cleanup]);

  const accept = useCallback(async () => {
    const offer = incomingOffer.current;
    const callId = callIdRef.current;
    if (!offer || !callId || !peer) return;
    Vibration.cancel();
    setPhase('connecting');
    try {
      const pc = await makePeerConnection(type);
      await pc.setRemoteDescription(new RTC.RTCSessionDescription(offer));
      remoteDescSet.current = true;
      for (const c of pendingRemoteIce.current.splice(0)) await pc.addIceCandidate(new RTC.RTCIceCandidate(c)).catch(() => {});
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket()?.emit('call:answer', { callId, answer: { type: answer.type, sdp: answer.sdp } });
      pendingLocalIce.current.splice(0).forEach((c) => getSocket()?.emit('call:ice', { callId, candidate: c }));
    } catch {
      getSocket()?.emit('call:end', { callId });
      cleanup();
      Alert.alert('Call failed', 'Could not join the call.');
    }
  }, [cleanup, makePeerConnection, peer, type]);

  const reject = useCallback(() => {
    if (callIdRef.current) getSocket()?.emit('call:reject', { callId: callIdRef.current });
    cleanup();
  }, [cleanup]);

  // signalling events
  useEffect(() => {
    if (!user?.id) return undefined;
    const offs = [
      onSocket('call:incoming', (d: any) => {
        if (!webrtcReady()) { getSocket()?.emit('call:reject', { callId: d.callId }); return; }
        if (phaseRef.current !== 'idle') { getSocket()?.emit('call:reject', { callId: d.callId }); return; }
        callIdRef.current = d.callId;
        incomingOffer.current = d.offer;
        setPeer({ id: d.from.id, name: d.from.name, avatar: d.from.avatar });
        setType(d.type === 'video' ? 'video' : 'audio');
        setPhase('ringing');
        Vibration.vibrate([0, 600, 900], true);
      }),
      onSocket('call:answered', async (d: any) => {
        if (d.callId !== callIdRef.current || !pcRef.current) return;
        try {
          setPhase('connecting');
          await pcRef.current.setRemoteDescription(new RTC.RTCSessionDescription(d.answer));
          remoteDescSet.current = true;
          for (const c of pendingRemoteIce.current.splice(0)) await pcRef.current.addIceCandidate(new RTC.RTCIceCandidate(c)).catch(() => {});
        } catch { hangUp(); }
      }),
      onSocket('call:ice', async (d: any) => {
        if (d.callId !== callIdRef.current) return;
        if (pcRef.current && remoteDescSet.current) await pcRef.current.addIceCandidate(new RTC.RTCIceCandidate(d.candidate)).catch(() => {});
        else pendingRemoteIce.current.push(d.candidate);
      }),
      onSocket('call:ended', (d: any) => {
        if (d.callId !== callIdRef.current) return;
        const missed = phaseRef.current === 'calling' && d.status === 'missed';
        const rejected = d.status === 'rejected';
        const name = peer?.name || '';
        cleanup();
        if (missed) Alert.alert('No answer', `${name} did not answer.`);
        else if (rejected) Alert.alert('Call declined', `${name} declined the call.`);
      }),
      // another device of mine answered / declined
      onSocket('call:handled', (d: any) => {
        if (d.callId === callIdRef.current && phaseRef.current === 'ringing') cleanup();
      }),
    ];
    return () => offs.forEach((o) => o());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, peer?.name]);

  const toggleMute = () => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((t: any) => { t.enabled = !next; });
    setMuted(next);
  };
  const toggleCam = () => {
    const next = !camOff;
    localRef.current?.getVideoTracks().forEach((t: any) => { t.enabled = !next; });
    setCamOff(next);
  };
  const flipCam = () => localRef.current?.getVideoTracks().forEach((t: any) => t._switchCamera && t._switchCamera());

  const available = webrtcReady();
  const value = useMemo(() => ({ available, start }), [available, start]);
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const RTCView = RTC?.RTCView;
  const statusText = phase === 'calling' ? 'Calling…' : phase === 'ringing' ? (type === 'video' ? 'Incoming video call' : 'Incoming voice call') : phase === 'connecting' ? 'Connecting…' : mmss;

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal visible={phase !== 'idle'} animationType="slide" onRequestClose={() => { /* must hang up explicitly */ }} statusBarTranslucent>
        <View style={styles.screen}>
          {type === 'video' && remoteStream && RTCView ? (
            <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
          ) : null}
          {type === 'video' && localStream && RTCView && !camOff ? (
            <RTCView streamURL={localStream.toURL()} style={styles.local} objectFit="cover" mirror zOrder={1} />
          ) : null}
          <View style={styles.top}>
            {!(type === 'video' && remoteStream) && peer ? (
              resolveUrl(peer.avatar) ? (
                <Image source={{ uri: resolveUrl(peer.avatar) || undefined }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{(peer.name || 'U').charAt(0).toUpperCase()}</Text></View>
              )
            ) : null}
            <Text style={styles.name}>{peer?.name}</Text>
            <Text style={styles.status}>{statusText}</Text>
          </View>
          <View style={styles.controls}>
            {phase === 'ringing' ? (
              <>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#F4212E' }]} onPress={reject}><Text style={styles.btnText}>✕</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#00BA7C' }]} onPress={accept}><Text style={styles.btnText}>✆</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.btn, muted && styles.btnOn]} onPress={toggleMute}><Text style={styles.btnText}>{muted ? '🔇' : '🎤'}</Text></TouchableOpacity>
                {type === 'video' ? (
                  <>
                    <TouchableOpacity style={[styles.btn, camOff && styles.btnOn]} onPress={toggleCam}><Text style={styles.btnText}>{camOff ? '🚫' : '📹'}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={flipCam}><Text style={styles.btnText}>🔄</Text></TouchableOpacity>
                  </>
                ) : null}
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#F4212E' }]} onPress={hangUp}><Text style={styles.btnText}>✕</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F0D1A', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 80 : 60, paddingBottom: 50 },
  top: { alignItems: 'center', gap: 10 },
  avatar: { width: 110, height: 110, borderRadius: 55 },
  avatarFallback: { backgroundColor: '#6C4DF6', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 44, fontWeight: '800' },
  name: { color: '#fff', fontSize: 26, fontWeight: '700' },
  status: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  local: { position: 'absolute', top: 60, right: 16, width: 110, height: 160, borderRadius: 12, overflow: 'hidden' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
  btn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  btnOn: { backgroundColor: 'rgba(255,255,255,0.45)' },
  btnText: { color: '#fff', fontSize: 26 },
});
