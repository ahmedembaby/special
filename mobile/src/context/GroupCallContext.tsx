import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import api from '../services/api';
import { getSocket, onSocket } from '../services/socket';
import { useAuth } from './AuthContext';

declare const require: any;
let RTC: any = null;
try { RTC = require('react-native-webrtc'); } catch { RTC = null; }

type GroupCallType = 'audio' | 'video';
type Participant = { id: string | number; name: string; avatar?: string | null };
interface GroupCallApi { available: boolean; start: (conversationId: string | number, type: GroupCallType) => Promise<void> }
const Context = createContext<GroupCallApi>({ available: !!RTC, start: async () => {} });
export const useGroupCall = () => useContext(Context);

export const GroupCallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [active, setActive] = useState<{ roomId: string; conversationId: number; type: GroupCallType } | null>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [screenStream, setScreenStream] = useState<any>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, any>>({});
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const peersRef = useRef<Map<string, any>>(new Map());
  const iceQueueRef = useRef<Map<string, any[]>>(new Map());
  const localRef = useRef<any>(null);
  const screenTrackRef = useRef<any>(null);
  const roomRef = useRef<string | null>(null);
  const hostRef = useRef(false);
  const activeRef = useRef<typeof active>(null);

  useEffect(() => { activeRef.current = active; }, [active]);

  const emitAck = useCallback((event: string, payload: any) => new Promise<any>((resolve) => {
    const socket = getSocket();
    if (!socket?.connected) return resolve({ error: 'Socket is not connected. Reopen the app and try again.' });
    socket.emit(event, payload, resolve);
  }), []);

  const iceServers = useCallback(async () => {
    try { return (await api.get('/calls/ice')).data.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]; }
    catch { return [{ urls: 'stun:stun.l.google.com:19302' }]; }
  }, []);

  const ensureLocalStream = useCallback(async (type: GroupCallType) => {
    if (!RTC?.mediaDevices?.getUserMedia) throw new Error('Native WebRTC is unavailable. Install a development build.');
    if (localRef.current) return localRef.current;
    const stream = await RTC.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: 'user', width: 1280, height: 720 } : false,
    });
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const createPeer = useCallback(async (peerId: string | number, roomId: string, stream: any) => {
    const key = String(peerId);
    const existing = peersRef.current.get(key);
    if (existing) return existing;
    const servers = await iceServers();
    const pc = new RTC.RTCPeerConnection({ iceServers: servers });
    stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));
    pc.onicecandidate = (event: any) => {
      if (event.candidate) getSocket()?.emit('call:group:ice', { roomId, targetId: Number(peerId), candidate: event.candidate });
    };
    pc.ontrack = (event: any) => {
      const remote = event.streams?.[0] || new RTC.MediaStream([event.track]);
      setRemoteStreams((prev) => ({ ...prev, [key]: remote }));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRemoteStreams((prev) => { const next = { ...prev }; delete next[key]; return next; });
      }
    };
    peersRef.current.set(key, pc);
    return pc;
  }, [iceServers]);

  const flushIce = useCallback(async (peerId: string | number, pc: any) => {
    const key = String(peerId);
    const queued = iceQueueRef.current.get(key) || [];
    iceQueueRef.current.delete(key);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(new RTC.RTCIceCandidate(candidate)); } catch {}
    }
  }, []);

  const createOffer = useCallback(async (peerId: string | number, roomId: string, stream: any) => {
    const pc = await createPeer(peerId, roomId, stream);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    getSocket()?.emit('call:group:offer', { roomId, targetId: Number(peerId), offer: pc.localDescription });
  }, [createPeer]);

  const cleanup = useCallback((emitLeave = false) => {
    const roomId = roomRef.current;
    if (emitLeave && roomId) getSocket()?.emit(hostRef.current ? 'call:group:end' : 'call:group:leave', { roomId });
    if (screenTrackRef.current) { try { screenTrackRef.current.stop(); } catch {} }
    screenTrackRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
    peersRef.current.forEach((pc) => { try { pc.close(); } catch {} });
    peersRef.current.clear();
    iceQueueRef.current.clear();
    localRef.current?.getTracks?.().forEach((track: any) => { try { track.stop(); } catch {} });
    localRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setParticipants([]);
    setActive(null);
    roomRef.current = null;
    hostRef.current = false;
    setMuted(false);
    setCameraOff(false);
    setConnecting(false);
  }, []);

  const join = useCallback(async (conversationId: number, roomId: string, type: GroupCallType) => {
    setConnecting(true);
    try {
      const stream = await ensureLocalStream(type);
      const result = await emitAck('call:group:join', { conversationId, roomId });
      if (result.error) throw new Error(result.error);
      roomRef.current = String(result.roomId);
      hostRef.current = false;
      setActive({ roomId: String(result.roomId), conversationId, type: result.type || type });
      setParticipants(result.participants || []);
      for (const peerId of result.peers || []) await createOffer(peerId, String(result.roomId), stream);
    } catch (error: any) {
      cleanup(false);
      Alert.alert('Unable to join group call', error?.message || 'Please try again.');
    } finally {
      setConnecting(false);
    }
  }, [cleanup, createOffer, emitAck, ensureLocalStream]);

  const start = useCallback(async (conversationId: string | number, type: GroupCallType) => {
    if (!RTC?.RTCPeerConnection || !RTC?.mediaDevices) {
      Alert.alert('Calls require a new build', 'Install the latest Special development build with native WebRTC support.');
      return;
    }
    if (activeRef.current || connecting) return;
    setConnecting(true);
    try {
      const stream = await ensureLocalStream(type);
      const result = await emitAck('call:group:start', { conversationId: Number(conversationId), type });
      if (result.error) {
        if (result.roomId) {
          await join(Number(conversationId), String(result.roomId), type);
          return;
        }
        throw new Error(result.error);
      }
      roomRef.current = String(result.roomId);
      hostRef.current = true;
      setActive({ roomId: String(result.roomId), conversationId: Number(conversationId), type });
      setParticipants(result.participants || []);
    } catch (error: any) {
      cleanup(false);
      Alert.alert('Unable to start group call', error?.message || 'Please try again.');
    } finally {
      setConnecting(false);
    }
  }, [cleanup, connecting, emitAck, ensureLocalStream, join]);

  const hangUp = useCallback(() => cleanup(true), [cleanup]);

  const toggleMic = useCallback(() => {
    const next = !muted;
    localRef.current?.getAudioTracks?.().forEach((track: any) => { track.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    localRef.current?.getVideoTracks?.().forEach((track: any) => { track.enabled = !next; });
    setCameraOff(next);
  }, [cameraOff]);

  const flipCamera = useCallback(() => {
    localRef.current?.getVideoTracks?.().forEach((track: any) => { if (track._switchCamera) track._switchCamera(); });
  }, []);

  const stopScreenShare = useCallback(async () => {
    const track = screenTrackRef.current;
    if (!track) return;
    const cameraTrack = localRef.current?.getVideoTracks?.()[0] || null;
    for (const pc of peersRef.current.values()) {
      const sender = pc.getSenders().find((item: any) => item.track?.kind === 'video');
      if (sender) await sender.replaceTrack(cameraTrack).catch(() => {});
    }
    try { track.stop(); } catch {}
    screenTrackRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!active || active.type !== 'video') {
      Alert.alert('Screen sharing', 'Start a video group call before sharing your screen.');
      return;
    }
    if (screenTrackRef.current) { await stopScreenShare(); return; }
    if (!RTC?.mediaDevices?.getDisplayMedia) {
      Alert.alert('Screen sharing unavailable', 'Screen capture is not supported by this device build.');
      return;
    }
    try {
      const stream = await RTC.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks?.()[0];
      if (!track) throw new Error('No screen track was returned');
      screenTrackRef.current = track;
      setScreenStream(stream);
      for (const pc of peersRef.current.values()) {
        const sender = pc.getSenders().find((item: any) => item.track?.kind === 'video');
        if (sender) await sender.replaceTrack(track);
      }
      track.onended = () => { stopScreenShare().catch(() => {}); };
      setScreenSharing(true);
    } catch (error: any) {
      Alert.alert('Screen sharing failed', error?.message || 'The operating system did not allow screen capture.');
    }
  }, [active, stopScreenShare]);

  useEffect(() => onSocket('call:group:incoming', (payload: any) => {
    if (activeRef.current || !payload?.roomId) return;
    Alert.alert(
      payload.type === 'video' ? 'Incoming group video call' : 'Incoming group voice call',
      (payload.from?.name || 'A group member') + ' started a call.',
      [
        { text: 'Decline', style: 'cancel' },
        { text: 'Join', onPress: () => join(Number(payload.conversationId), String(payload.roomId), payload.type === 'video' ? 'video' : 'audio') },
      ]
    );
  }), [join]);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      const data: any = response?.notification?.request?.content?.data;
      if (data?.type === 'group_call' && data.roomId && data.conversationId && !activeRef.current) {
        join(Number(data.conversationId), String(data.roomId), data.type === 'video' ? 'video' : 'audio');
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => {});
    return () => subscription.remove();
  }, [join]);

  useEffect(() => onSocket('call:group:participant_joined', ({ roomId, participant }: any) => {
    if (roomRef.current !== String(roomId) || !participant) return;
    setParticipants((prev) => prev.some((p) => String(p.id) === String(participant.id)) ? prev : [...prev, participant]);
  }), []);

  useEffect(() => onSocket('call:group:participant_left', ({ roomId, userId }: any) => {
    if (roomRef.current !== String(roomId)) return;
    const key = String(userId);
    const pc = peersRef.current.get(key);
    if (pc) { try { pc.close(); } catch {} peersRef.current.delete(key); }
    setRemoteStreams((prev) => { const next = { ...prev }; delete next[key]; return next; });
    setParticipants((prev) => prev.filter((p) => String(p.id) !== key));
  }), []);

  useEffect(() => onSocket('call:group:offer', async ({ roomId, fromId, offer }: any) => {
    if (roomRef.current !== String(roomId) || !localRef.current) return;
    try {
      const pc = await createPeer(fromId, String(roomId), localRef.current);
      await pc.setRemoteDescription(new RTC.RTCSessionDescription(offer));
      await flushIce(fromId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket()?.emit('call:group:answer', { roomId, targetId: Number(fromId), answer: pc.localDescription });
    } catch (error) { console.warn('group call offer:', error); }
  }), [createPeer, flushIce]);

  useEffect(() => onSocket('call:group:answer', async ({ roomId, fromId, answer }: any) => {
    if (roomRef.current !== String(roomId)) return;
    const pc = peersRef.current.get(String(fromId));
    if (!pc) return;
    try { await pc.setRemoteDescription(new RTC.RTCSessionDescription(answer)); await flushIce(fromId, pc); }
    catch (error) { console.warn('group call answer:', error); }
  }), [flushIce]);

  useEffect(() => onSocket('call:group:ice', async ({ roomId, fromId, candidate }: any) => {
    if (roomRef.current !== String(roomId) || !candidate) return;
    const key = String(fromId);
    const pc = peersRef.current.get(key);
    if (!pc || !pc.remoteDescription) {
      iceQueueRef.current.set(key, [...(iceQueueRef.current.get(key) || []), candidate]);
      return;
    }
    try { await pc.addIceCandidate(new RTC.RTCIceCandidate(candidate)); } catch {}
  }), []);

  useEffect(() => onSocket('call:group:ended', ({ roomId }: any) => {
    if (roomRef.current === String(roomId)) cleanup(false);
  }), [cleanup]);

  useEffect(() => () => cleanup(true), [cleanup]);

  const RTCView = RTC?.RTCView;
  const allParticipants = participants.length ? participants : (user?.id ? [{ id: user.id, name: user.name || 'You', avatar: user.avatar }] : []);
  const renderTile = (participant: Participant, stream?: any, local = false) => (
    <View key={String(participant.id)} style={styles.tile}>
      {active?.type === 'video' && stream && RTCView ? (
        <RTCView streamURL={stream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror={local} />
      ) : null}
      <View style={styles.tileLabel}><Text style={styles.tileName}>{local ? 'You' : participant.name}</Text></View>
    </View>
  );

  return (
    <Context.Provider value={{ available: !!(RTC?.RTCPeerConnection && RTC?.mediaDevices), start }}>
      {children}
      <Modal visible={!!active || connecting} animationType="slide" onRequestClose={hangUp} statusBarTranslucent>
        <View style={styles.modal}>
          <View style={styles.top}>
            <Text style={styles.title}>{active?.type === 'video' ? 'Group video call' : 'Group voice call'}</Text>
            <Text style={styles.subtitle}>{participants.length}/5 participants</Text>
          </View>
          {connecting ? <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 40 }} /> : (
            <ScrollView contentContainerStyle={styles.grid}>
              {active?.type === 'video' ? (
                <>
                  {localStream ? renderTile({ id: user?.id || 'me', name: user?.name || 'You' }, screenStream || localStream, true) : null}
                  {Object.entries(remoteStreams).map(([id, stream]) => renderTile(participants.find((p) => String(p.id) === id) || { id, name: 'Participant' }, stream))}
                </>
              ) : allParticipants.map((p) => (
                <View key={String(p.id)} style={styles.audioTile}><Text style={styles.audioAvatar}>{(p.name || '?').slice(0, 1).toUpperCase()}</Text><Text style={styles.tileName}>{String(p.id) === String(user?.id) ? 'You' : p.name}</Text></View>
              ))}
            </ScrollView>
          )}
          <View style={styles.controls}>
            <TouchableOpacity onPress={toggleMic} style={[styles.control, muted && styles.controlOn]}><Text style={styles.controlText}>{muted ? 'Unmute' : 'Mute'}</Text></TouchableOpacity>
            {active?.type === 'video' ? <TouchableOpacity onPress={toggleCamera} style={[styles.control, cameraOff && styles.controlOn]}><Text style={styles.controlText}>{cameraOff ? 'Camera on' : 'Camera off'}</Text></TouchableOpacity> : null}
            {active?.type === 'video' ? <TouchableOpacity onPress={flipCamera} style={styles.control}><Text style={styles.controlText}>Flip</Text></TouchableOpacity> : null}
            {active?.type === 'video' ? <TouchableOpacity onPress={toggleScreenShare} style={[styles.control, screenSharing && styles.controlOn]}><Text style={styles.controlText}>{screenSharing ? 'Stop share' : 'Share screen'}</Text></TouchableOpacity> : null}
            <TouchableOpacity onPress={hangUp} style={[styles.control, styles.hangup]}><Text style={styles.controlText}>End</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Context.Provider>
  );
};

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#10131B', paddingTop: 58, paddingHorizontal: 16, paddingBottom: 28 },
  top: { alignItems: 'center', marginBottom: 18 },
  title: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  subtitle: { color: '#AAB2C5', fontSize: 13, marginTop: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingBottom: 20 },
  tile: { width: '47%', aspectRatio: 0.78, backgroundColor: '#252B3A', borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  tileLabel: { backgroundColor: 'rgba(0,0,0,0.45)', padding: 8 },
  tileName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  audioTile: { width: '44%', minHeight: 125, borderRadius: 18, backgroundColor: '#252B3A', alignItems: 'center', justifyContent: 'center', gap: 9 },
  audioAvatar: { width: 58, height: 58, borderRadius: 29, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', color: '#FFFFFF', backgroundColor: '#5364D8', fontSize: 25, fontWeight: '800' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingTop: 12 },
  control: { minWidth: 72, paddingHorizontal: 13, paddingVertical: 13, borderRadius: 14, backgroundColor: '#30394D', alignItems: 'center' },
  controlOn: { backgroundColor: '#46598C' },
  hangup: { backgroundColor: '#C83248' },
  controlText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
