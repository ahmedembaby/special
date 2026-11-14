import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  SafeAreaView, View, FlatList, ActivityIndicator, StatusBar, Platform, AppState, KeyboardAvoidingView, Alert, StyleSheet,
  TextInput, TouchableOpacity, Text, Modal, PanResponder, ScrollView,
} from 'react-native';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image as ImageCompressor, Video as VideoCompressor } from 'react-native-compressor';
import { Icon } from '../components/Icon';
import { Colors, Typography, Spacing, BorderRadius } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
import * as api from '../services/api';
import { AIAssistantSheet } from '../components/AIAssistantSheet';
import { resolveUrl } from '../config';
import { useAuth } from '../context/AuthContext';
import { getChatName } from '../components/ChatItem';
import { VoiceBubble, RecordingDot } from '../components/VoiceBubble';
import { SwipeToReply } from '../components/SwipeToReply';
import { LinkPreview, firstUrl } from '../components/LinkPreview';
import { PollBubble } from '../components/PollBubble';
import { enqueue, newClientId, isRetryable, outboxFor, subscribeOutbox, removeFromOutbox, retryItem, flushOutbox } from '../services/outbox';
import { getDraft, setDraft, getTheme, saveTheme, ChatTheme, NO_THEME, WALLPAPERS, BUBBLE_COLORS, isDarkColor } from '../services/chatPrefs';
import { ImageViewer } from '../components/ImageViewer';
import { CachedImage } from '../components/CachedImage';
import { onSocket, joinConversation, leaveConversation, emitTyping } from '../services/socket';
import * as e2ee from '../services/e2ee';
import { OptionSheet, SheetOption } from '../components/OptionSheet';
import { ReportSheet, ReportTarget } from '../components/ReportSheet';
import { Linking } from 'react-native';
import { useCall } from '../context/CallContext';
import { useGroupCall } from '../context/GroupCallContext';
import { authenticateBiometric, biometricAvailable } from '../services/appLock';
import * as chatSecurity from '../services/chatSecurity';

const PAGE_SIZE = 50;

const ChatVideo = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer({ uri }, (instance) => { instance.loop = false; });
  return (
    <VideoView player={player} style={{ width: 230, height: 230, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' }} contentFit="contain" nativeControls />
  );
};

const appendUnique = (list: api.Message[], msg: api.Message): api.Message[] =>
  msg.id != null && list.some((m) => String(m.id) === String(msg.id)) ? list : [...list, msg];

// reaction helpers (the list is grouped by emoji: {emoji, count, users, my_reaction})
const addReaction = (list: api.MessageReaction[] | undefined, r: { emoji: string; user_id: string | number; user_name?: string; user_avatar?: string | null }, mine: boolean): api.MessageReaction[] => {
  const reactions = list || [];
  const user = { id: r.user_id, name: r.user_name || '', avatar: r.user_avatar || undefined };
  const existing = reactions.find((x) => x.emoji === r.emoji);
  if (!existing) return [...reactions, { emoji: r.emoji, count: 1, users: [user], my_reaction: mine }];
  if (existing.users.some((u) => String(u.id) === String(r.user_id))) return reactions;
  return reactions.map((x) => (x.emoji === r.emoji ? { ...x, count: x.count + 1, users: [...x.users, user], my_reaction: x.my_reaction || mine } : x));
};
const removeReaction = (list: api.MessageReaction[] | undefined, userId: string | number, emoji: string): api.MessageReaction[] =>
  (list || [])
    .map((x) => {
      if (x.emoji !== emoji) return x;
      const users = x.users.filter((u) => String(u.id) !== String(userId));
      return { ...x, users, count: users.length, my_reaction: users.length === x.users.length ? x.my_reaction : false };
    })
    .filter((x) => x.count > 0);

export default function ChatScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { c, isDark } = useAppColors();
  const X_BLUE = c.primary;
  const BG_GRAY = c.surface;
  const BORDER_GRAY = c.border;
  const TEXT_GRAY_900 = c.text;
  const TEXT_GRAY_500 = c.textSecondary;
  const TEXT_GRAY_400 = c.textMuted;
  const styles = useMemo(() => makeStyles(c, { X_BLUE, BG_GRAY, BORDER_GRAY, TEXT_GRAY_900, TEXT_GRAY_500, TEXT_GRAY_400 }), [c]);
  const conversationId = route.params?.conversationId;
  const routeName: string = route.params?.conversationName || '';
  const routeAvatar: string = route.params?.conversationAvatar || '';
  const routePhone: string = route.params?.conversationPhone || '';

  const listRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messages, setMessages] = useState<api.Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  useEffect(() => {
    const storyReplyText = route.params?.storyReplyText;
    if (typeof storyReplyText === 'string' && storyReplyText.trim()) {
      setInput(storyReplyText);
      navigation.setParams({ storyReplyText: undefined });
    }
  }, [route.params?.storyReplyText, navigation]);

  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [msgOffset, setMsgOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const recordingRef = useRef<any>(null);
  const recStartRef = useRef(0);
  const samplesRef = useRef<number[]>([]);
  const holdModeRef = useRef(false);
  const startPromiseRef = useRef<Promise<void> | undefined>(undefined);
  const voiceFns = useRef<any>({});
  const holdRef = useRef<{ active: boolean; cancel: boolean; timer: ReturnType<typeof setTimeout> | null }>({ active: false, cancel: false, timer: null });
  const [liveLevels, setLiveLevels] = useState<number[]>([]);
  const [recWaveform, setRecWaveform] = useState<string | undefined>(undefined);
  const [cancelHint, setCancelHint] = useState(false);
  // press and hold = record while held; quick tap = start/stop with preview
  const micPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      const h = holdRef.current;
      h.active = false; h.cancel = false;
      h.timer = setTimeout(() => { h.active = true; voiceFns.current.start(true); }, 250);
    },
    onPanResponderMove: (_e, g) => {
      const cancel = g.dx < -80;
      holdRef.current.cancel = cancel;
      setCancelHint(cancel);
    },
    onPanResponderRelease: () => {
      const h = holdRef.current;
      if (h.timer) clearTimeout(h.timer);
      setCancelHint(false);
      if (!h.active) { voiceFns.current.start(false); return; }
      h.active = false;
      voiceFns.current.release(h.cancel);
    },
    onPanResponderTerminate: () => {
      const h = holdRef.current;
      if (h.timer) clearTimeout(h.timer);
      setCancelHint(false);
      if (h.active) { h.active = false; voiceFns.current.release(true); }
    },
  })).current;
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reactionModalVisible, setReactionModalVisible] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<api.Message | null>(null);
  const [reactionEmojis] = useState<string[]>(['❤️', '😂', '👍', '😮', '😢', '🔥', '👏', '🎉']);
  const [msgSearch, setMsgSearch] = useState('');
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [typingKind, setTypingKind] = useState<'typing' | 'recording'>('typing');
  // new chat features
  const unreadAtOpen: number = Number(route.params?.unread) || 0;
  const [unreadDividerId, setUnreadDividerId] = useState<string | null>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [theme, setTheme] = useState<ChatTheme>(NO_THEME);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeDraft, setThemeDraft] = useState<ChatTheme>(NO_THEME);
  const [themeAll, setThemeAll] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyTo, setReplyTo] = useState<api.Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [serverHits, setServerHits] = useState<api.Message[]>([]);
  const [menu, setMenu] = useState<null | 'main' | 'mute' | 'disappear' | 'forward' | 'readers'>(null);
  const [meta, setMeta] = useState<{ muted: boolean; disappear: number | null }>({ muted: false, disappear: null });
  const [peerKey, setPeerKey] = useState<string | null>(null);
  const [myKey, setMyKey] = useState<string | null>(null);
  const [report, setReport] = useState<ReportTarget>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [scheduleMenu, setScheduleMenu] = useState<null | 'when' | 'list'>(null);
  const [scheduledList, setScheduledList] = useState<Array<{ id: number; content: string; send_at: string }>>([]);
  const [pinned, setPinned] = useState<api.Conversation['pinned_message']>(null);
  const [archived, setArchived] = useState(false);
  const [forwardList, setForwardList] = useState<api.Conversation[]>([]);
  const [, setTick] = useState(0);
  const call = useCall();
  const groupCall = useGroupCall();

  const { user, updateUser } = useAuth();
  const currentUserId: string | number = user?.id ?? 'me';
  const isMine = (senderId: string | number | undefined) => String(senderId) === String(currentUserId);

  // Header info: the route may carry it, otherwise load the conversation
  const [header, setHeader] = useState<{ name: string; avatar: string; handle: string; userId?: string | number; status?: string; lastSeen?: string | null }>({
    name: routeName || '',
    avatar: routeAvatar || '',
    handle: routePhone || '',
  });
  const [inGroup, setInGroup] = useState(false);
  const [chatAccessReady, setChatAccessReady] = useState(false);
  const [chatAccessConversationId, setChatAccessConversationId] = useState<string | null>(null);
  const loadedConversationRef = useRef<string | null>(null);
  const suppressLockRef = useRef(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [chatUnlocked, setChatUnlocked] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    api.conversations.get(conversationId).then((res) => {
      const conv = res.data;
      const other = conv.participants?.[0];
      setInGroup(conv.type === 'group');
      setMeta({ muted: !!conv.muted, disappear: conv.disappear_after ?? null });
      setPinned(conv.pinned_message || null);
      setArchived(!!conv.archived);
      setPeerKey(conv.type === 'group' ? null : other?.public_key || null);
      setHeader({
        name: getChatName(conv),
        avatar: (conv.type === 'group' ? conv.avatar : other?.avatar) || '',
        userId: conv.type === 'group' ? undefined : other?.id,
        handle: conv.type === 'group' ? `${(conv.participants?.length || 0) + 1} members` : other?.username || '',
        status: conv.type === 'group' ? undefined : (other as any)?.status,
        lastSeen: conv.type === 'group' ? undefined : (other as any)?.last_seen,
      });
    }).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    setChatAccessReady(false);
    setChatAccessConversationId(null);
    loadedConversationRef.current = null;
    setChatUnlocked(false);
    if (!conversationId) { setChatLocked(false); setChatAccessReady(true); return; }
    chatSecurity.isConversationLocked(conversationId).then((enabled) => {
      if (!active) return;
      setChatLocked(enabled); setChatUnlocked(!enabled); setChatAccessConversationId(String(conversationId)); setChatAccessReady(true);
    });
    return () => { active = false; };
  }, [conversationId]);


  useEffect(() => {
    if (!isFocused && chatLocked) setChatUnlocked(false);
  }, [isFocused, chatLocked]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && chatLocked && !suppressLockRef.current) setChatUnlocked(false);
    });
    return () => sub.remove();
  }, [chatLocked]);

  const unlockChat = async () => {
    if (await authenticateBiometric('Unlock this conversation')) setChatUnlocked(true);
    else Alert.alert('Authentication required', 'Use your device biometrics to open this conversation.');
  };

  const toggleChatLock = async () => {
    if (!conversationId) return;
    if (chatLocked) {
      if (!(await authenticateBiometric('Remove conversation lock'))) return;
      await chatSecurity.setConversationLocked(conversationId, false);
      setChatLocked(false); setChatUnlocked(true); return;
    }
    if (!(await biometricAvailable())) {
      Alert.alert('Biometrics unavailable', 'Set up Face ID or fingerprint on your device before locking a conversation.'); return;
    }
    if (!(await authenticateBiometric('Lock this conversation'))) return;
    try { await chatSecurity.setConversationLocked(conversationId, true); setChatLocked(true); setChatUnlocked(false); }
    catch { Alert.alert('Error', 'Could not enable the conversation lock on this device.'); }
  };
  // Refresh the peer public key after a key-rotation event so the safety number is current.
  // The user must still compare the updated number with the contact out of band.
  useEffect(() => {
    if (!conversationId || !header.userId) return undefined;
    return onSocket('security_key_changed', (event: { userId?: string | number }) => {
      if (String(event.userId) !== String(header.userId)) return;
      api.conversations.get(conversationId).then((res) => {
        const peer = res.data.participants?.find((p) => String(p.id) === String(header.userId));
        setPeerKey(peer?.public_key || null);
      }).catch(() => {});
    });
  }, [conversationId, header.userId]);

  // live online / last-seen of the other person (the server skips users who hide their status)
  useEffect(() => {
    if (!header.userId) return undefined;
    return onSocket('user_status', (d: { userId: string | number; status: string }) => {
      if (String(d.userId) !== String(header.userId)) return;
      setHeader((h) => ({ ...h, status: d.status, lastSeen: d.status === 'online' ? h.lastSeen : new Date().toISOString() }));
    });
  }, [header.userId]);

  // end-to-end encryption keys of this device
  useEffect(() => {
    if (!user?.id) return;
    e2ee.ensureKeys(user.id, user.public_key).then(setMyKey).catch(() => {});
  }, [user?.id]);
  const encryptionOn = !inGroup && !!peerKey && !!myKey;
  // the text of a message (decrypted when needed)
  const textOf = useCallback((m: { content?: string }): string => {
    const content = m.content || '';
    if (!e2ee.isEncrypted(content)) return content;
    return e2ee.decrypt(peerKey, content) ?? '🔒 Message can\'t be decrypted on this device';
  }, [peerKey, myKey]);

  // expired disappearing messages vanish without waiting for the server
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  const alive = (m: api.Message) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now();

  // ---- initial load (reactions come with the messages, no per-message requests) ----
  useEffect(() => {
    if (!conversationId || !chatAccessReady || chatAccessConversationId !== String(conversationId) || (chatLocked && !chatUnlocked)) return undefined;
    if (loadedConversationRef.current === String(conversationId)) return undefined;
    loadedConversationRef.current = String(conversationId);
    let cancelled = false;
    let completed = false;
    (async () => {
      setLoading(true);
      try {
        const msgRes = await api.conversations.messages(conversationId!, PAGE_SIZE, 0);
        if (cancelled) return;
        const loaded = msgRes.data?.messages || [];
        setHasMoreMessages(msgRes.data?.hasMore || false);
        setMsgOffset(loaded.length);
        // unsent messages waiting in the offline outbox are shown at the end, marked "Not sent"
        const pending = await outboxFor(conversationId!);
        const queued = pending.map((it): api.Message => ({
          id: `temp_${it.clientId}`, client_id: it.clientId, conversation_id: conversationId!, sender_id: currentUserId,
          content: it.kind === 'text' ? it.content || '' : '', type: it.kind === 'text' ? 'text' : (it.file?.type || '').startsWith('audio') ? 'voice' : 'image',
          file_url: it.file?.uri, voice_duration: it.voice_duration, voice_waveform: it.voice_waveform ?? null,
          status: it.failed ? 'failed' : 'queued', created_at: it.createdAt,
        }));
        setMessages([...loaded, ...queued.filter((q) => !loaded.some((m) => m.client_id && m.client_id === q.client_id))]);
        completed = true;
        if (unreadAtOpen > 0) {
          const incoming = loaded.filter((m) => String(m.sender_id) !== String(currentUserId));
          const first = incoming[Math.max(0, incoming.length - unreadAtOpen)];
          if (first) {
            setUnreadDividerId(String(first.id));
            atBottomRef.current = false;
            setNewCount(unreadAtOpen);
            setShowJump(true);
            const idx = loaded.indexOf(first);
            setTimeout(() => listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.12, animated: false }), 300);
          }
        }
        api.messages.markAllRead(conversationId!).catch(() => {});
      } catch {
        if (!cancelled) { loadedConversationRef.current = null; Alert.alert('Error', 'Could not load the conversation'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (!completed && loadedConversationRef.current === String(conversationId)) loadedConversationRef.current = null;
    };
  }, [conversationId, chatAccessReady, chatAccessConversationId, chatLocked, chatUnlocked]);

  // draft + theme of this chat
  useEffect(() => {
    if (!conversationId) return;
    getDraft(conversationId).then((d) => { if (d) setInput((cur) => cur || d); });
    getTheme(conversationId).then(setTheme);
  }, [conversationId]);

  // offline outbox events: replace the "queued" copy with the real message
  useEffect(() => subscribeOutbox((e) => {
    if (e.type === 'sent') {
      if (String(e.message.conversation_id) !== String(conversationId)) return;
      setMessages((prev) => appendUnique(prev.filter((m) => m.client_id !== e.clientId && String(m.id) !== `temp_${e.clientId}`), e.message));
    } else if (e.type === 'failed') {
      setMessages((prev) => prev.map((m) => (m.client_id === e.clientId ? { ...m, status: 'failed' as const } : m)));
    } else if (e.type === 'queued') {
      setMessages((prev) => prev.map((m) => (m.client_id === e.clientId ? { ...m, status: 'queued' as const } : m)));
    } else if (e.type === 'removed') {
      // removed + not "sent" = the user deleted it
    }
  }), [conversationId]);

  // ---- realtime ----
  useEffect(() => {
    if (!conversationId) return undefined;
    joinConversation(conversationId);

    const offs = [
      onSocket('message_received', (msg: api.Message) => {
        if (String(msg.conversation_id) !== String(conversationId)) return;
        setMessages((prev) => appendUnique(prev, msg));
        if (!isMine(msg.sender_id) && !atBottomRef.current) setNewCount((n) => n + 1);
        // The chat is open: everything incoming is read right away
        if (!isMine(msg.sender_id)) api.messages.markAllRead(conversationId).catch(() => {});
      }),
      onSocket('typing', (data: { conversationId: string | number; userId: string | number; userName: string; isTyping: boolean; kind?: string }) => {
        if (String(data.conversationId) !== String(conversationId) || isMine(data.userId)) return;
        setTypingKind(data.isTyping ? (data.kind === 'recording' ? 'recording' : 'typing') : 'typing');
        setTypingUsers((prev) => (data.isTyping ? [...new Set([...prev, data.userName])] : prev.filter((n) => n !== data.userName)));
      }),
      onSocket('message_delivered', (data: { messageId: string | number }) => {
        setMessages((prev) => prev.map((m) => (String(m.id) === String(data.messageId) && m.status !== 'read' ? { ...m, status: 'delivered' as const } : m)));
      }),
      onSocket('message_read', (data: { messageId: string | number }) => {
        setMessages((prev) => prev.map((m) => (String(m.id) === String(data.messageId) ? { ...m, status: 'read' as const } : m)));
      }),
      onSocket('messages_read', (data: { conversationId: string | number; userId: string | number }) => {
        if (String(data.conversationId) !== String(conversationId) || isMine(data.userId)) return;
        setMessages((prev) => prev.map((m) => (isMine(m.sender_id) ? { ...m, status: 'read' as const } : m)));
      }),
      onSocket('message_edited', (data: { message: api.Message }) => {
        setMessages((prev) => prev.map((m) => (String(m.id) === String(data.message.id) ? { ...m, ...data.message, reactions: m.reactions } : m)));
      }),
      onSocket('conversation_updated', (conv: api.Conversation) => {
        if (!conv || Array.isArray(conv) || String(conv.id) !== String(conversationId)) return;
        setMeta({ muted: !!conv.muted, disappear: conv.disappear_after ?? null });
      }),
      onSocket('poll_updated', (d: { message_id: string | number; conversation_id: string | number; poll: api.Poll }) => {
        if (String(d.conversation_id) !== String(conversationId)) return;
        setMessages((prev) => prev.map((m) => {
          if (String(m.id) !== String(d.message_id) || !m.poll) return m;
          const mine = m.poll.my_option;
          return { ...m, poll: { ...d.poll, my_option: mine, options: d.poll.options.map((o) => ({ ...o, my: o.id === mine })) } };
        }));
      }),
      onSocket('conversation_pinned_message', (d: any) => { if (String(d.conversation_id) === String(conversationId)) setPinned(d.pinned_message || null); }),
      onSocket('message_deleted', (data: { message_id: string | number }) => {
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(data.message_id)));
      }),
      // Reactions from other people (our own are applied locally right after the API call)
      onSocket('reaction_added', (data: { message_id: string | number; reaction: any }) => {
        if (isMine(data.reaction?.user_id)) return;
        setMessages((prev) => prev.map((m) => (String(m.id) === String(data.message_id) ? { ...m, reactions: addReaction(m.reactions, data.reaction, false) } : m)));
      }),
      onSocket('reaction_removed', (data: { message_id: string | number; user_id: string | number; emoji: string }) => {
        if (isMine(data.user_id)) return;
        setMessages((prev) => prev.map((m) => (String(m.id) === String(data.message_id) ? { ...m, reactions: removeReaction(m.reactions, data.user_id, data.emoji) } : m)));
      }),
    ];

    return () => {
      offs.forEach((off) => off());
      leaveConversation(conversationId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (recordingRef.current) {
        Promise.resolve(recordingRef.current.stop?.()).catch(() => {});
        recordingRef.current = null;
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId]);

  const pickImage = async (viewOnce = false) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo access to send media.');
        return;
      }
      suppressLockRef.current = true;
      let res;
      try {
        res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: viewOnce ? ['images'] : ['images', 'videos'],
          quality: 0.85,
          videoMaxDuration: 180,
        });
      } finally {
        suppressLockRef.current = false;
      }
      if (res.canceled || !res.assets?.[0]) return;

      const asset = res.assets[0];
      const isVideoAsset = !viewOnce && asset.type === 'video';
      const uploadFile: { uri: string; type: string; name: string } = {
        uri: asset.uri,
        type: asset.mimeType || (isVideoAsset ? 'video/mp4' : 'image/jpeg'),
        name: asset.fileName || (isVideoAsset ? 'video.mp4' : 'photo.jpg'),
      };
      setUploading(true);
      try {
        try {
          if (isVideoAsset) {
            uploadFile.uri = await VideoCompressor.compress(asset.uri, {
              compressionMethod: 'auto',
              maxSize: 1280,
              minimumFileSizeForCompress: 2,
              preserveMetadata: false,
            });
          } else {
            uploadFile.uri = await ImageCompressor.compress(asset.uri, {
              compressionMethod: 'auto',
              maxWidth: 1600,
              maxHeight: 1600,
              quality: 0.8,
            });
            uploadFile.type = 'image/jpeg';
            if (!/\.jpe?g$/i.test(uploadFile.name)) uploadFile.name = uploadFile.name.replace(/\.[^.]+$/, '') + '.jpg';
          }
        } catch {
          Alert.alert('Compression skipped', 'The original file will be sent because compression was unavailable on this device.');
        }
        const response = await api.messages.upload({
          conversation_id: conversationId!,
          reply_to: replyTo?.id,
          view_once: viewOnce,
          file: uploadFile,
        });
        setMessages((prev) => appendUnique(prev, response.data));
        setReplyTo(null);
      } catch (error: any) {
        if (isRetryable(error)) await queueUpload(uploadFile, { view_once: viewOnce });
        else Alert.alert('Error', error?.response?.data?.message || 'Media could not be sent');
      } finally {
        setUploading(false);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick media');
    } finally {
      suppressLockRef.current = false;
    }
  };


  const pickDocument = async () => {
    try {
      suppressLockRef.current = true;
      let result;
      try {
        result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      } finally {
        suppressLockRef.current = false;
      }
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const file = { uri: asset.uri, type: asset.mimeType || 'application/octet-stream', name: asset.name || 'document' };
      setUploading(true);
      try {
        const response = await api.messages.upload({ conversation_id: conversationId!, reply_to: replyTo?.id, file });
        setMessages((prev) => appendUnique(prev, response.data));
        setReplyTo(null);
      } catch (error: any) {
        if (isRetryable(error)) await queueUpload(file, {});
        else Alert.alert('Error', error?.response?.data?.message || 'Document could not be sent');
      } finally {
        setUploading(false);
      }
    } catch {
      Alert.alert('Error', 'Could not open the document picker');
    }
  };

  const openAttachmentMenu = () => Alert.alert('Attach to message', 'Choose what you want to send.', [
    { text: 'Photo or video', onPress: () => pickImage(false) },
    { text: 'Document', onPress: pickDocument },
    { text: 'Cancel', style: 'cancel' },
  ]);



  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending || !conversationId) return;

    const replying = replyTo;
    setSending(true);
    setReplyTo(null);
    const clientId = newClientId();
    const tempId = `temp_${clientId}`;
    const createdAt = new Date().toISOString();
    atBottomRef.current = true;
    setMessages((prev) => appendUnique(prev, {
      id: tempId, client_id: clientId, conversation_id: conversationId!, sender_id: currentUserId, content, type: 'text', reply: replying ? { id: replying.id, content: replying.content, type: replying.type, sender_id: replying.sender_id, sender_name: replying.sender_name } : null, status: 'sending', created_at: createdAt,
    }));
    setInput('');
    setDraft(conversationId!, '');
    emitTyping(conversationId!, false);

    const wire = content;
    try {
      const res = await api.messages.send({ conversation_id: conversationId!, content: wire, reply_to: replying?.id, client_id: clientId });
      setMessages((prev) => {
        // the socket echo may already have added the real message: keep a single copy
        const withoutTemp = prev.filter((m) => String(m.id) !== tempId);
        return appendUnique(withoutTemp, res.data);
      });
    } catch (e) {
      if (isRetryable(e)) {
        // no connection: keep it in the outbox, it is sent automatically when the connection is back
        await enqueue({ clientId, conversationId: conversationId!, kind: 'text', content: wire, replyTo: replying?.id ?? null, createdAt });
        setMessages((prev) => prev.map((m) => (String(m.id) === tempId ? { ...m, status: 'queued' as const } : m)));
      } else {
        Alert.alert('Error', (e as any)?.response?.data?.message || 'Message could not be sent');
        setMessages((prev) => prev.filter((m) => String(m.id) !== tempId));
        setInput(content);
        setReplyTo(replying);
      }
    } finally {
      setSending(false);
    }
  };

  // media (image / voice) that could not be uploaded goes to the outbox as well
  const queueUpload = async (file: { uri: string; type?: string; name?: string }, extra: { voice_duration?: string; voice_waveform?: string; view_once?: boolean }) => {
    const clientId = newClientId();
    const createdAt = new Date().toISOString();
    await enqueue({ clientId, conversationId: conversationId!, kind: 'upload', file, replyTo: replyTo?.id ?? null, createdAt, ...extra });
    const isAudio = (file.type || '').startsWith('audio');
    setMessages((prev) => appendUnique(prev, {
      id: `temp_${clientId}`, client_id: clientId, conversation_id: conversationId!, sender_id: currentUserId, content: '', type: isAudio ? 'voice' : 'image',
      file_url: file.uri, voice_duration: extra.voice_duration, voice_waveform: extra.voice_waveform ?? null, status: 'queued', created_at: createdAt,
    }));
    setReplyTo(null);
  };

  const onChangeDraftSave = (text: string) => {
    if (!conversationId) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => setDraft(conversationId, text), 400);
  };

  const loadMoreMessages = async () => {
    if (!hasMoreMessages || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const msgRes = await api.conversations.messages(conversationId!, PAGE_SIZE, msgOffset);
      const older = msgRes.data?.messages || [];
      if (older.length) {
        setHasMoreMessages(msgRes.data.hasMore);
        setMsgOffset((prev) => prev + older.length);
        setMessages((prev) => [...older.filter((o) => !prev.some((m) => String(m.id) === String(o.id))), ...prev]);
      } else {
        setHasMoreMessages(false);
      }
    } catch {
      // silent: the next scroll retries
    } finally {
      setLoadingMore(false);
    }
  };

  const onScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.y < 80) loadMoreMessages();
    const atBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 140;
    atBottomRef.current = atBottom;
    setShowJump(!atBottom && contentSize.height > layoutMeasurement.height * 1.5);
    if (atBottom) setNewCount(0);
  };

  const jumpToLatest = () => {
    atBottomRef.current = true;
    setNewCount(0);
    setShowJump(false);
    listRef.current?.scrollToEnd({ animated: true });
  };

  const closeOptions = () => {
    setReactionModalVisible(false);
    setSelectedMessageForReaction(null);
    setEditMessageText('');
  };

  const toggleReaction = async (emoji: string) => {
    if (!selectedMessageForReaction) return;
    const msgId = selectedMessageForReaction.id;
    const mine = (selectedMessageForReaction.reactions || []).find((r) => r.my_reaction);
    closeOptions();
    const patch = (fn: (r: api.MessageReaction[] | undefined) => api.MessageReaction[]) =>
      setMessages((prev) => prev.map((m) => (String(m.id) === String(msgId) ? { ...m, reactions: fn(m.reactions) } : m)));
    const me = { user_id: currentUserId, user_name: user?.name, user_avatar: user?.avatar };
    try {
      if (mine) {
        await api.messages.removeReaction(msgId, mine.emoji);
        patch((r) => removeReaction(r, currentUserId, mine.emoji));
      }
      if (!mine || mine.emoji !== emoji) {
        await api.messages.addReaction(msgId, emoji);
        patch((r) => addReaction(r, { emoji, ...me }, true));
      }
    } catch {
      Alert.alert('Error', 'Could not update reaction');
    }
  };

  const [editMessageText, setEditMessageText] = useState('');

  const editMessage = async (newContent: string) => {
    if (!selectedMessageForReaction) return;
    const text = newContent.trim();
    if (!text) return;
    setSending(true);
    try {
      const msgId = selectedMessageForReaction.id;
      const res = await api.messages.editMessage(msgId, text);
      setMessages((prev) => prev.map((m) => (String(m.id) === String(msgId) ? { ...m, ...res.data, reactions: m.reactions } : m)));
      closeOptions();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not edit message');
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (scope: 'me' | 'all' = 'all') => {
    if (!selectedMessageForReaction) return;
    setSending(true);
    try {
      const msgId = selectedMessageForReaction.id;
      await api.messages.deleteMessage(msgId, scope);
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(msgId)));
      closeOptions();
    } catch {
      Alert.alert('Error', 'Could not delete message');
    } finally {
      setSending(false);
    }
  };

  // ---- stars, selection, polls, read-by, theme ----
  const toggleStar = async () => {
    const m = selectedMessageForReaction;
    if (!m) return;
    closeOptions();
    const next = !m.starred;
    setMessages((prev) => prev.map((x) => (String(x.id) === String(m.id) ? { ...x, starred: next } : x)));
    try { await (next ? api.messages.star(m.id) : api.messages.unstar(m.id)); }
    catch {
      setMessages((prev) => prev.map((x) => (String(x.id) === String(m.id) ? { ...x, starred: !next } : x)));
      Alert.alert('Error', 'Could not update the star');
    }
  };

  const startSelect = () => {
    const m = selectedMessageForReaction;
    closeOptions();
    if (m && !String(m.id).startsWith('temp_')) { setSelectMode(true); setSelected([String(m.id)]); }
  };
  const toggleSelect = (m: api.Message) => {
    if (String(m.id).startsWith('temp_')) return;
    setSelected((prev) => {
      const id = String(m.id);
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!next.length) setSelectMode(false);
      return next;
    });
  };
  const exitSelect = () => { setSelectMode(false); setSelected([]); };
  const selectedMessages = () => messages.filter((m) => selected.includes(String(m.id)));

  const deleteSelected = () => {
    const list = selectedMessages();
    if (!list.length) return;
    const run = async (scope: 'me' | 'all') => {
      const results = await Promise.allSettled(list.map((m) => api.messages.deleteMessage(m.id, scope)));
      const ok = list.filter((_, i) => results[i].status === 'fulfilled').map((m) => String(m.id));
      setMessages((prev) => prev.filter((m) => !ok.includes(String(m.id))));
      if (ok.length < list.length) Alert.alert('Some messages were not deleted', 'Only your own messages can be deleted for everyone.');
      exitSelect();
    };
    const allMine = list.every((m) => isMine(m.sender_id));
    Alert.alert(`Delete ${list.length} message${list.length > 1 ? 's' : ''}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete for me', onPress: () => run('me') },
      ...(allMine ? [{ text: 'Delete for everyone', style: 'destructive' as const, onPress: () => run('all') }] : []),
    ]);
  };

  const forwardSelected = async () => {
    const list = selectedMessages();
    if (!list.length) return;
    setForwardMsgs(list);
    try {
      const res = await api.conversations.list();
      setForwardList(res.data);
      setMenu('forward');
    } catch { Alert.alert('Error', 'Could not load your conversations'); }
  };

  const votePoll = async (m: api.Message, optionId: number) => {
    try {
      const r = await api.messages.vote(m.id, optionId);
      setMessages((prev) => prev.map((x) => (String(x.id) === String(m.id) ? { ...x, poll: r.data.poll } : x)));
    } catch { Alert.alert('Error', 'Could not vote'); }
  };

  const createPoll = async () => {
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || options.length < 2) { Alert.alert('Poll', 'Write a question and at least 2 options.'); return; }
    try {
      const r = await api.messages.createPoll(conversationId!, pollQuestion.trim(), options);
      atBottomRef.current = true;
      setMessages((prev) => appendUnique(prev, r.data));
      setPollOpen(false); setPollQuestion(''); setPollOptions(['', '']);
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.message || 'Could not create the poll'); }
  };

  const [readersInfo, setReadersInfo] = useState<{ title: string; rows: string[] } | null>(null);
  const showReaders = async () => {
    const m = selectedMessageForReaction;
    if (!m) return;
    closeOptions();
    try {
      const r = await api.messages.readers(m.id);
      setReadersInfo({
        title: `Seen by ${r.data.readers.length} of ${r.data.total}`,
        rows: r.data.readers.length ? r.data.readers.map((u) => `${u.name} · ${new Date(u.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`) : ['Nobody has read it yet'],
      });
      setMenu('readers');
    } catch { Alert.alert('Error', 'Could not load the list'); }
  };

  const retryQueued = (m: api.Message) => { if (m.client_id) { m.status === 'failed' ? retryItem(m.client_id) : flushOutbox(); } };
  const discardQueued = async (m: api.Message) => {
    if (m.client_id) await removeFromOutbox(m.client_id);
    setMessages((prev) => prev.filter((x) => String(x.id) !== String(m.id)));
  };

  // ---- reply / forward / menus ----
  const startReply = () => {
    if (!selectedMessageForReaction) return;
    setReplyTo(selectedMessageForReaction);
    closeOptions();
  };

  const openForward = async () => {
    const msg = selectedMessageForReaction;
    if (!msg) return;
    setForwardMsgs([msg]);
    closeOptions();
    try {
      const res = await api.conversations.list();
      setForwardList(res.data);
      setMenu('forward');
    } catch {
      Alert.alert('Error', 'Could not load your conversations');
    }
  };
  const [forwardMsgs, setForwardMsgs] = useState<api.Message[]>([]);

  const forwardTo = async (target: api.Conversation) => {
    const list = forwardMsgs;
    if (!list.length) return;
    let sent = 0;
    for (const msg of [...list].sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime())) {
      try {
        let content: string | undefined;
        if (msg.type === 'text' || !msg.type) {
          const plain = textOf(msg);
          content = plain;
        }
        await api.messages.forward(msg.id, [{ conversation_id: target.id, content }]);
        sent += 1;
      } catch { /* continue with the next one */ }
    }
    if (sent === list.length) Alert.alert('Forwarded', `${sent} message${sent > 1 ? 's' : ''} sent to ${getChatName(target)}`);
    else Alert.alert('Forward', `${sent} of ${list.length} forwarded. Polls and some messages cannot be forwarded.`);
    setForwardMsgs([]);
    exitSelect();
  };

  const setMute = async (hours: number) => {
    try {
      const res = await api.conversations.mute(conversationId!, hours);
      setMeta((m) => ({ ...m, muted: !!res.data.muted }));
    } catch { Alert.alert('Error', 'Could not update mute'); }
  };
  const setDisappear = async (seconds: number) => {
    try {
      const res = await api.conversations.disappearing(conversationId!, seconds);
      setMeta((m) => ({ ...m, disappear: res.data.disappear_after ?? null }));
    } catch { Alert.alert('Error', 'Could not update the timer'); }
  };
  const showSafety = () => {
    if (!myKey || !peerKey) return Alert.alert('Encryption unavailable', 'Both participants must configure encryption before direct text messages can be sent.');
    Alert.alert('End-to-end encrypted', `Compare this number with ${header.name} (in person or by call). If it matches, nobody is in the middle.\n\n${e2ee.safetyNumber(myKey, peerKey)}`);
  };

  // search: the loaded messages (decrypted) + server results for older plain-text messages
  useEffect(() => {
    const q = msgSearch.trim();
    if (q.length < 2 || !conversationId) { setServerHits([]); return undefined; }
    const t = setTimeout(() => {
      api.conversations.search(conversationId, q).then((r) => setServerHits(r.data.messages || [])).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [msgSearch, conversationId]);

  const visibleMessages = useMemo(() => {
    const q = msgSearch.trim().toLowerCase();
    const live = messages.filter(alive);
    if (!q) return live;
    const local = live.filter((m) => m.type !== 'image' && textOf(m).toLowerCase().includes(q));
    const extra = serverHits.filter((h) => !local.some((m) => String(m.id) === String(h.id)));
    return [...extra, ...local].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, msgSearch, serverHits, textOf]);

  const scrollToMessage = (id: string | number) => {
    setMsgSearch('');
    setTimeout(() => {
      const idx = messages.findIndex((m) => String(m.id) === String(id));
      if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
    }, 50);
  };

  const sendLocation = async () => {
    try {
      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Allow location access to share where you are.');
      const pos = await Location.getCurrentPositionAsync({});
      const text = `📍 https://maps.google.com/?q=${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`;
      const res = await api.messages.send({ conversation_id: conversationId!, content: text });
      setMessages((prev) => appendUnique(prev, res.data));
    } catch {
      Alert.alert('Error', 'Could not get your location (needs a build with the location permission).');
    }
  };

  // ---- stickers, scheduled messages, view-once, translate ----
  const STICKERS = ['🦄', '🐱', '🐶', '🐼', '🦊', '🐸', '🐵', '🐧', '🔥', '💯', '🎉', '🥳', '😍', '🤣', '😭', '😎', '🤝', '👏', '🙏', '💪', '❤️', '💔', '🤔', '🙄', '🥰', '😴', '🤩', '👀', '🍕', '☕', '🎂', '🌹'];

  const sendSticker = async (emoji: string) => {
    setStickerOpen(false);
    try {
      const text = `sticker:${emoji}`;
      const res = await api.messages.send({ conversation_id: conversationId!, content: text, reply_to: replyTo?.id });
      setMessages((prev) => appendUnique(prev, res.data));
      setReplyTo(null);
    } catch { Alert.alert('Error', 'Could not send the sticker'); }
  };

  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const schedule = async (when: Date) => {
    const text = input.trim();
    if (!text) return Alert.alert('Write a message first', 'Type the message in the box, then choose when to send it.');
    if (when.getTime() < Date.now() + 60000) return Alert.alert('Pick a later time');
    try {
      await api.messages.schedule(conversationId!, text, when.toISOString());
      setInput('');
      Alert.alert('Scheduled', `Will be sent ${when.toLocaleString()}.`);
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.message || 'Could not schedule'); }
  };
  const openScheduled = async () => {
    try { setScheduledList((await api.messages.scheduled(conversationId!)).data); setScheduleMenu('list'); }
    catch { Alert.alert('Error', 'Could not load scheduled messages'); }
  };

  const openViewOnce = async (m: api.Message) => {
    try {
      const r = await api.messages.openViewOnce(m.id);
      setMessages((prev) => prev.map((x) => (String(x.id) === String(m.id) ? { ...x, opened: true } : x)));
      setViewerUri(resolveUrl(r.data.file_url));
    } catch (e: any) {
      Alert.alert('Not available', e?.response?.status === 410 ? 'This photo was already opened.' : 'Could not open the photo.');
    }
  };

  const translateMessage = async () => {
    const m = selectedMessageForReaction;
    if (!m) return;
    closeOptions();
    const text = textOf(m);
    const target = /[\u0600-\u06FF]/.test(text) ? 'en' : 'ar';
    try {
      const r = await api.messages.translate(text, target);
      Alert.alert(target === 'ar' ? 'Translation (Arabic)' : 'Translation (English)', r.data.translation);
    } catch (e: any) {
      Alert.alert('Translation unavailable', e?.response?.data?.message || 'Try again later.');
    }
  };

  const transcribeVoiceMessage = async () => {
    const message = selectedMessageForReaction;
    if (!message || message.type !== 'voice') return;
    closeOptions();
    try {
      const result = await api.ai.transcribeMessage(message.id);
      Alert.alert('Voice transcription', result.data.text || 'No speech was detected.');
    } catch (error: any) {
      Alert.alert('Transcription unavailable', error?.response?.data?.message || 'Could not transcribe this recording.');
    }
  };

  const aiContext = messages
    .filter((message) => message.type === 'text' || !message.type)
    .slice(-35)
    .map((message) => (isMine(message.sender_id) ? 'Me' : message.sender_name || 'Participant') + ': ' + textOf(message))
    .join('\\n')
    .slice(-16000);

  const DISAPPEAR_OPTIONS: Array<[string, number]> = [['Off', 0], ['1 hour', 3600], ['24 hours', 86400], ['7 days', 604800], ['90 days', 7776000]];

  const mainMenu: SheetOption[] = [
    { label: chatLocked ? 'Remove biometric conversation lock' : 'Lock conversation with biometrics', onPress: toggleChatLock },
    { label: showSearch ? 'Hide search' : 'Search in conversation', onPress: () => { setShowSearch((v) => !v); setMsgSearch(''); } },
    { label: meta.muted ? 'Unmute notifications' : 'Mute notifications', onPress: () => (meta.muted ? setMute(0) : setMenu('mute')) },
    { label: `Disappearing messages${meta.disappear ? ' (on)' : ''}`, onPress: () => setMenu('disappear') },
    { label: 'Special AI assistant', onPress: () => setAiOpen(true) },
    ...(inGroup ? [
      { label: 'Start group voice call', onPress: () => groupCall.start(conversationId!, 'audio') },
      { label: 'Start group video call', onPress: () => groupCall.start(conversationId!, 'video') },
    ] : []),
    { label: 'Create a poll', onPress: () => setPollOpen(true) },
    { label: 'Chat theme (wallpaper & colors)', onPress: () => { setThemeDraft(theme); setThemeOpen(true); } },
    { label: 'Starred messages', onPress: () => navigation.navigate('Starred') },
    { label: 'Select messages', onPress: () => { const last = [...messages].reverse().find((m) => !String(m.id).startsWith('temp_')); if (last) { setSelectMode(true); setSelected([String(last.id)]); } } },
    { label: 'Stickers', onPress: () => setStickerOpen(true) },
    { label: 'Send a view-once photo', onPress: () => pickImage(true) },
    { label: 'Schedule the typed message', onPress: () => setScheduleMenu('when') },
    { label: 'Scheduled messages', onPress: openScheduled },
    { label: 'Send my location', onPress: sendLocation },
    { label: archived ? 'Unarchive chat' : 'Archive chat', onPress: async () => { try { const r = await api.conversations.archive(conversationId!); setArchived(!!r.data.archived); if (r.data.archived) navigation.goBack(); } catch { Alert.alert('Error', 'Could not archive'); } } },
    ...(!inGroup && header.userId != null ? [{
      label: 'Block user', danger: true,
      onPress: () => Alert.alert('Block user', `${header.name} will not be able to message you.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: async () => { try { await api.safety.block(header.userId!); navigation.goBack(); } catch { Alert.alert('Error', 'Could not block'); } } },
      ]),
    }, { label: 'Report user', danger: true, onPress: () => setReport({ type: 'user', id: header.userId! }) }] : []),
    ...(!inGroup ? [{ label: encryptionOn ? 'Encryption (verify)' : 'Encryption', onPress: showSafety }] : []),
  ];

  // ---- voice messages (expo-audio: works in Expo Go) ----
  const fmtSecs = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

  // dB samples -> 34 digits (0-9), one per waveform bar
  const toWaveform = (samples: number[]): string | undefined => {
    const valid = samples.filter((x) => typeof x === 'number' && isFinite(x));
    if (valid.length < 4) return undefined;
    const bars = 34;
    let out = '';
    for (let i = 0; i < bars; i++) {
      const from = Math.floor((i * valid.length) / bars);
      const to = Math.max(from + 1, Math.floor(((i + 1) * valid.length) / bars));
      const peak = Math.max(...valid.slice(from, to));
      const level = Math.min(1, Math.max(0, (peak + 55) / 55)); // -55 dB (silence) .. 0 dB
      out += String(Math.max(1, Math.round(level * 9)));
    }
    return out;
  };

  const startRecording = async (hold = false): Promise<void> => {
    if (recordingRef.current || recording) return;
    try {
      const { AudioModule, RecordingPresets, setAudioModeAsync } = await import('expo-audio');
      suppressLockRef.current = true;
      let perm;
      try { perm = await AudioModule.requestRecordingPermissionsAsync(); }
      finally { suppressLockRef.current = false; }
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow microphone access to record voice messages.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      const rec = new AudioModule.AudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true } as any);
      await rec.prepareToRecordAsync();
      rec.record();
      recordingRef.current = rec;
      recStartRef.current = Date.now();
      samplesRef.current = [];
      holdModeRef.current = hold;
      setRecordingUri(null);
      setRecWaveform(undefined);
      setLiveLevels([]);
      setRecording(true);
      emitTyping(conversationId!, true, 'recording');
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        const st = (() => { try { return rec.getStatus?.(); } catch { return null; } })();
        const db = typeof st?.metering === 'number' ? st.metering : undefined;
        if (db !== undefined) {
          samplesRef.current.push(db);
          setLiveLevels((prev) => [...prev.slice(-29), Math.min(1, Math.max(0.05, (db + 55) / 55))]);
        }
        setRecordingDuration(Math.floor((Date.now() - recStartRef.current) / 1000));
      }, 120);
    } catch {
      Alert.alert('Error', 'Could not start recording');
    }
  };

  /** Stops the recorder and returns { uri, seconds, waveform } (null if nothing was recorded). */
  const finishRecording = async () => {
    emitTyping(conversationId!, false, 'recording');
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    const rec = recordingRef.current;
    recordingRef.current = null;
    setRecording(false);
    if (!rec) return null;
    const seconds = Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000));
    let uri: string | null = null;
    try {
      await rec.stop();
      uri = rec.uri || null;
      const { setAudioModeAsync } = await import('expo-audio');
      await setAudioModeAsync({ allowsRecording: false });
    } catch { /* ignore */ }
    if (!uri) return null;
    return { uri, seconds, waveform: toWaveform(samplesRef.current) };
  };

  // tap mode: stop and show the preview (listen, then send or delete)
  const stopRecording = async () => {
    const r = await finishRecording();
    if (!r) { Alert.alert('Error', 'Could not stop recording'); return; }
    setRecordingDuration(r.seconds);
    setRecWaveform(r.waveform);
    setRecordingUri(r.uri);
  };

  const cancelRecording = async () => {
    await finishRecording();
    setRecordingUri(null);
    setRecordingDuration(0);
    setRecWaveform(undefined);
  };

  const sendVoice = async (uri: string, seconds: number, waveform?: string) => {
    setUploading(true);
    try {
      const res = await api.messages.upload({
        conversation_id: conversationId!,
        reply_to: replyTo?.id,
        file: { uri, type: 'audio/mp4', name: 'voice.m4a' },
        voice_duration: fmtSecs(seconds),
        voice_waveform: waveform,
      });
      setMessages((prev) => appendUnique(prev, res.data));
      setRecordingUri(null);
      setRecWaveform(undefined);
      setReplyTo(null);
    } catch (e) {
      if (isRetryable(e)) {
        await queueUpload({ uri, type: 'audio/mp4', name: 'voice.m4a' }, { voice_duration: fmtSecs(seconds), voice_waveform: waveform });
        setRecordingUri(null);
        setRecWaveform(undefined);
      } else {
        Alert.alert('Error', 'Voice message could not be sent');
      }
    } finally {
      setUploading(false);
    }
  };

  const sendVoiceMessage = () => { if (recordingUri) sendVoice(recordingUri, recordingDuration, recWaveform); };

  // hold mode: released -> send, slid left (or shorter than 1s) -> discard
  const releaseHold = async (cancel: boolean) => {
    await startPromiseRef.current;
    if (!recordingRef.current) return;
    const tooShort = Date.now() - recStartRef.current < 1000;
    const r = await finishRecording();
    if (!r || cancel || tooShort) { setRecordingDuration(0); return; }
    sendVoice(r.uri, r.seconds, r.waveform);
  };

  voiceFns.current = {
    start: (hold: boolean) => { startPromiseRef.current = startRecording(hold); },
    release: releaseHold,
  };

  const onLongPressMessage = (msg: api.Message) => {
    if (String(msg.id).startsWith('temp_')) return;
    setSelectedMessageForReaction(msg);
    setEditMessageText(msg.type === 'text' || !msg.type ? textOf(msg) : '');
    setReactionModalVisible(true);
  };

  // Typing indicator: "typing" on the first keystroke, "stopped" after 2s of silence
  const onChangeInput = (text: string) => {
    setInput(text);
    onChangeDraftSave(text);
    if (!conversationId) return;
    if (text.length && !typingTimerRef.current) emitTyping(conversationId, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
      emitTyping(conversationId, false);
    }, 2000);
  };

  const dayLabel = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'short', year: diff < 300 ? undefined : 'numeric' });
  };
  const sameDay = (a?: string, b?: string) => !!a && !!b && new Date(a).toDateString() === new Date(b).toDateString();
  const presenceText = () => {
    if (inGroup || !header.userId) return '';
    if (header.status === 'online') return 'Online';
    if (header.lastSeen) {
      const d = new Date(header.lastSeen);
      return `Last seen ${sameDay(header.lastSeen, new Date().toISOString()) ? 'today' : d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return '';
  };

  const timeFormat = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const wall = theme.wallpaper || c.background;
  const bubbleCol = theme.bubble;
  const ownBubbleStyle = bubbleCol ? { backgroundColor: bubbleCol, shadowColor: bubbleCol } : null;

  const statusIcon = (status: string | undefined) => {
    switch (status) {
      case 'sending': return 'clock';
      case 'sent': return 'check';
      case 'delivered': return 'checkRead';
      case 'read': return 'checkRead';
      default: return 'clock';
    }
  };

  const statusColor = (status: string | undefined, isOwn: boolean) => {
    if (!isOwn) return 'transparent';
    switch (status) {
      case 'sending': return 'rgba(255,255,255,0.6)';
      case 'sent': return 'rgba(255,255,255,0.8)';
      case 'delivered': return X_BLUE;
      case 'read': return X_BLUE;
      default: return 'rgba(255,255,255,0.6)';
    }
  };

  if (!chatAccessReady || (chatLocked && !chatUnlocked)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Icon name="lock" size={48} color={c.primary} />
        <Text style={{ color: c.text, fontSize: 21, fontWeight: '800', marginTop: 18, marginBottom: 8 }}>Conversation locked</Text>
        <Text style={{ color: c.textSecondary, textAlign: 'center', marginBottom: 22 }}>Authenticate with Face ID or fingerprint to view these messages.</Text>
        <TouchableOpacity onPress={unlockChat} style={{ backgroundColor: c.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Unlock with biometrics</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: wall }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { backgroundColor: c.card, shadowColor: c.shadow }]}>
        <TouchableOpacity style={styles.backWrap} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Icon name="arrowLeft" size={24} color={X_BLUE} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={header.userId != null ? 0.7 : 1}
            onPress={() => header.userId != null && navigation.navigate('UserProfile', { userId: String(header.userId) })}
          >
            {header.avatar ? (
              <CachedImage source={{ uri: resolveUrl(header.avatar) || undefined }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: c.primary }]}>
                <Text style={[styles.avatarInitial, { color: '#FFFFFF' }]}>
                  {header.name ? header.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.nameWrap}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: TEXT_GRAY_900 }]} numberOfLines={1}>{header.name || ' '}</Text>
            </View>
            <Text style={[styles.phone, { color: presenceText() === 'Online' ? c.success : TEXT_GRAY_500 }]} numberOfLines={1}>
              {encryptionOn ? '🔒 ' : ''}{meta.muted ? '🔕 ' : ''}{meta.disappear ? '⏱ ' : ''}{presenceText() || (inGroup ? header.handle : header.handle ? `@${header.handle}` : '')}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          {!inGroup && header.userId != null && call.available ? (
            <>
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => call.start({ id: header.userId!, name: header.name, avatar: header.avatar }, 'video')}>
                <Icon name="video" size={20} color={X_BLUE} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => call.start({ id: header.userId!, name: header.name, avatar: header.avatar }, 'audio')}>
                <Icon name="phone" size={20} color={X_BLUE} />
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => setMenu('main')}>
            <Icon name="moreHorizontal" size={20} color={X_BLUE} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch ? <View style={[styles.searchWrap, { borderBottomColor: BORDER_GRAY }]}>
        <View style={[styles.searchInputWrap, { backgroundColor: BG_GRAY, borderColor: BORDER_GRAY }]}>
          <Icon name="search" size={20} color={TEXT_GRAY_500} />
          <TextInput
            placeholder="Search in this conversation"
            placeholderTextColor={TEXT_GRAY_500}
            value={msgSearch}
            onChangeText={setMsgSearch}
            style={[styles.searchInput, { color: TEXT_GRAY_900 }]}
            autoFocus
          />
        </View>
      </View> : null}

      {selectMode ? (
        <View style={[styles.selectBar, { backgroundColor: c.card, shadowColor: c.shadow }]}>
          <TouchableOpacity onPress={exitSelect} hitSlop={10}><Text style={{ color: TEXT_GRAY_900, fontSize: 20 }}>✕</Text></TouchableOpacity>
          <Text style={{ color: TEXT_GRAY_900, fontWeight: '700', fontSize: 16, flex: 1, marginLeft: 14 }}>{selected.length} selected</Text>
          <TouchableOpacity onPress={forwardSelected} style={styles.selectBtn}><Text style={{ color: X_BLUE, fontWeight: '700' }}>↪ Forward</Text></TouchableOpacity>
          <TouchableOpacity onPress={deleteSelected} style={styles.selectBtn}><Text style={{ color: c.danger, fontWeight: '700' }}>🗑 Delete</Text></TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.loadingWrap, { backgroundColor: wall }]}>
          <ActivityIndicator size="large" color={X_BLUE} />
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={visibleMessages}
            onScrollToIndexFailed={() => {}}
            keyExtractor={(item, index) => String(item.id ?? index)}
            contentContainerStyle={[styles.listContent, { backgroundColor: wall }]}
            onContentSizeChange={() => {
              // stay where the user is reading unless they are at the bottom (or it is the first load)
              if (atBottomRef.current) listRef.current?.scrollToEnd({ animated: !!messages.length });
            }}
            onScroll={onScroll}
            scrollEventThrottle={64}
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Icon name="mail" size={64} color={TEXT_GRAY_500} />
                <Text style={[styles.emptyTitle, { color: TEXT_GRAY_900 }]}>No messages yet</Text>
                <Text style={[styles.emptySubtitle, { color: TEXT_GRAY_500 }]}>Say hello to start the conversation.</Text>
              </View>
            }
            ListFooterComponent={
              hasMoreMessages ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={X_BLUE} />
                </View>
              ) : undefined
            }
            renderItem={({ item, index }) => {
              const isOwn = isMine(item.sender_id);
              const prev = index > 0 ? visibleMessages[index - 1] : undefined;
              const newDay = !prev || !sameDay(prev.created_at, item.created_at);
              const groupedWithPrev = !!prev && !newDay && String(prev.sender_id) === String(item.sender_id) && new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
              const isFile = item.type === 'file';
              const isVoice = item.type === 'voice';
              const isImage = item.type === 'image';
              const isVideo = item.type === 'video';
              const isPoll = item.type === 'poll';
              const isTemp = String(item.id).startsWith('temp_');
              const isSel = selected.includes(String(item.id));
              const url = !isPoll && !isVoice && !isImage && !isVideo && !isFile && !item.view_once && !String(item.content || '').startsWith('e2ee:') && !textOf(item).startsWith('sticker:') && !textOf(item).startsWith('📍') ? firstUrl(textOf(item)) : null;
              const showStatus = isOwn && ['sent', 'delivered', 'read'].includes(item.status || '');

              return (
                <View style={isSel ? { backgroundColor: 'rgba(108,77,246,0.16)' } : undefined}>
                {String(item.id) === unreadDividerId ? (
                  <View style={styles.dayWrap}>
                    <Text style={[styles.dayText, { color: '#FFFFFF', backgroundColor: X_BLUE }]}>Unread messages</Text>
                  </View>
                ) : null}
                {newDay ? (
                  <View style={styles.dayWrap}>
                    <Text style={[styles.dayText, { color: TEXT_GRAY_500, backgroundColor: c.inputBg }]}>{dayLabel(item.created_at)}</Text>
                  </View>
                ) : null}
                <SwipeToReply enabled={!selectMode && !isTemp} onReply={() => setReplyTo(item)}>
                <TouchableOpacity
                  style={[styles.messageWrap, isOwn ? styles.ownWrap : styles.otherWrap, groupedWithPrev && { marginTop: -3 }]}
                  onPress={selectMode ? () => toggleSelect(item) : undefined}
                  onLongPress={() => (selectMode ? toggleSelect(item) : onLongPressMessage(item))}
                  activeOpacity={0.85}
                >
                  {!isOwn && inGroup && !groupedWithPrev ? (
                    <View style={styles.senderRow}>
                      {item.sender_avatar ? (
                        <CachedImage source={{ uri: resolveUrl(item.sender_avatar) || undefined }} style={styles.msgAvatar} />
                      ) : (
                        <View style={[styles.msgAvatar, { backgroundColor: c.primary }]} />
                      )}
                      <Text style={[styles.senderName, { color: X_BLUE }]} numberOfLines={1}>{item.sender_name || ''}</Text>
                    </View>
                  ) : null}
                  <View pointerEvents={selectMode ? 'none' : 'auto'} style={[styles.bubbleContainer, isOwn ? styles.bubbleContainerOwn : styles.bubbleContainerOther]}>
                    {item.forwarded ? <Text style={[styles.forwardedLabel, { color: TEXT_GRAY_500 }]}>↪ Forwarded</Text> : null}
                    {item.reply ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => !item.reply?.deleted && scrollToMessage(item.reply!.id)}
                        style={[styles.quote, { backgroundColor: c.inputBg, borderLeftColor: X_BLUE }]}
                      >
                        {item.reply.deleted ? (
                          <Text style={[styles.quoteText, { color: TEXT_GRAY_500 }]}>Original message was deleted</Text>
                        ) : (
                          <>
                            <Text style={[styles.quoteName, { color: X_BLUE }]} numberOfLines={1}>
                              {isMine(item.reply.sender_id) ? 'You' : item.reply.sender_name || ''}
                            </Text>
                            <Text style={[styles.quoteText, { color: TEXT_GRAY_900 }]} numberOfLines={2}>
                              {item.reply.type === 'image' ? '📷 Photo' : item.reply.type === 'voice' ? '🎤 Voice message' : item.reply.type === 'file' ? '📎 File' : textOf({ content: item.reply.content })}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
                    {isPoll && item.poll ? (
                      <TouchableOpacity activeOpacity={1} onLongPress={() => onLongPressMessage(item)}>
                        <PollBubble question={textOf(item)} poll={item.poll} isOwn={isOwn} accent={bubbleCol || undefined} onVote={(oid) => votePoll(item, oid)} />
                      </TouchableOpacity>
                    ) : null}
                    {isPoll ? null : isFile && item.file_url ? (
                      <TouchableOpacity
                        style={[styles.fileBubble, isOwn ? styles.ownFileBubble : styles.otherFileBubble, isOwn ? ownBubbleStyle : null]}
                        activeOpacity={0.8}
                        onPress={() => {
                          const fileUrl = resolveUrl(item.file_url);
                          if (fileUrl) Linking.openURL(fileUrl).catch(() => Alert.alert('File unavailable', 'Could not open this document on your device.'));
                        }}
                        onLongPress={() => onLongPressMessage(item)}
                      >
                        <View style={styles.fileContent}>
                          <Icon name="file" size={24} color={isOwn ? '#FFFFFF' : TEXT_GRAY_500} />
                          <View style={styles.fileInfo}>
                            <Text style={[styles.fileName, { color: isOwn ? '#FFFFFF' : TEXT_GRAY_900 }]}>
                              {item.file_name || 'File'}
                            </Text>
                            <Text style={[styles.fileSize, { color: isOwn ? 'rgba(255,255,255,0.85)' : TEXT_GRAY_500 }]}>
                              {(item.file_size ? (item.file_size / 1024).toFixed(1) : 0)} KB
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ) : isImage && item.file_url ? (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerUri(resolveUrl(item.file_url))} onLongPress={() => onLongPressMessage(item)}>
                        <CachedImage source={{ uri: resolveUrl(item.file_url) || undefined }} style={{ width: 230, height: 230, borderRadius: 20, backgroundColor: c.inputBg }} resizeMode="cover" />
                      </TouchableOpacity>
                    ) : isVideo && item.file_url ? (
                      <TouchableOpacity activeOpacity={0.95} onLongPress={() => onLongPressMessage(item)}>
                        <ChatVideo uri={resolveUrl(item.file_url) || ''} />
                      </TouchableOpacity>
                    ) : item.view_once ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={isOwn || !!item.opened}
                        onPress={() => openViewOnce(item)}
                        onLongPress={() => onLongPressMessage(item)}
                        style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble, isOwn ? ownBubbleStyle : null]}
                      >
                        <Text style={[styles.messageText, { color: isOwn ? '#FFFFFF' : TEXT_GRAY_900 }]}>
                          {item.opened ? '📷 Opened' : isOwn ? '📷 View-once photo' : '📷 Tap to view (once)'}
                        </Text>
                      </TouchableOpacity>
                    ) : !isVoice && textOf(item).startsWith('sticker:') ? (
                      <TouchableOpacity activeOpacity={0.9} onLongPress={() => onLongPressMessage(item)}>
                        <Text style={{ fontSize: 64 }}>{textOf(item).slice(8)}</Text>
                      </TouchableOpacity>
                    ) : !isVoice ? (
                      <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble, isOwn ? ownBubbleStyle : null]}>
                        <Text
                          style={[styles.messageText, { color: isOwn ? '#FFFFFF' : TEXT_GRAY_900 }, textOf(item).startsWith('📍 http') && { textDecorationLine: 'underline' }]}
                          onPress={textOf(item).startsWith('📍 http') ? () => Linking.openURL(textOf(item).slice(2).trim()) : undefined}
                        >
                          {textOf(item)}
                        </Text>
                        {url ? <LinkPreview url={url} isOwn={isOwn} /> : null}
                      </View>
                    ) : null}
                    {isVoice && item.file_url ? (
                      <TouchableOpacity activeOpacity={1} onLongPress={() => onLongPressMessage(item)}>
                        <VoiceBubble uri={resolveUrl(item.file_url) || ''} durationLabel={item.voice_duration} waveform={(item as any).voice_waveform} messageId={String(item.id)} isOwn={isOwn} seed={String(item.id)} accent={bubbleCol} />
                      </TouchableOpacity>
                    ) : null}
                    <View style={[styles.metaRow, isOwn ? styles.metaRowOwn : styles.metaRowOther]}>
                      <Text style={[styles.time, { color: TEXT_GRAY_400 }]}>
                        {timeFormat(item.created_at)}
                      </Text>
                      {item.starred ? <Text style={{ fontSize: 11 }}>⭐</Text> : null}
                      {item.status === 'queued' ? (
                        <TouchableOpacity onPress={() => retryQueued(item)} hitSlop={8}>
                          <Text style={{ color: c.warning, fontSize: 11, fontWeight: '700' }}>⏳ Not sent · tap to retry</Text>
                        </TouchableOpacity>
                      ) : item.status === 'failed' ? (
                        <TouchableOpacity onPress={() => discardQueued(item)} hitSlop={8}>
                          <Text style={{ color: c.danger, fontSize: 11, fontWeight: '700' }}>❗ Not sent · tap to remove</Text>
                        </TouchableOpacity>
                      ) : null}
                      {showStatus && (
                        <View style={[styles.statusWrap, { backgroundColor: statusColor(item.status, true) }]}>
                          <Icon name={statusIcon(item.status)} size={13} color='#FFFFFF' />
                        </View>
                      )}
                    </View>
                  </View>
                  {item.reactions && item.reactions.length > 0 && (
                    <View style={styles.reactionsRow}>
                      {item.reactions.map((r: api.MessageReaction) => (
                        <TouchableOpacity
                          key={r.emoji}
                          style={[styles.reactionItem, r.my_reaction && styles.reactionMy]}
                          onPress={() => toggleReaction(r.emoji)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.reactionEmoji, { fontSize: 15 }]}>{r.emoji}</Text>
                          <Text style={[styles.reactionCount, r.my_reaction && styles.reactionMyCount]}>{r.count}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
                </SwipeToReply>
                </View>
              );
            }}
          />
          {typingUsers.length > 0 ? (
            <View style={[styles.typingWrap, { backgroundColor: wall }]}>
              <View style={styles.typingDots}>
                <View style={[styles.typingDot, { backgroundColor: TEXT_GRAY_500 }]} />
                <View style={[styles.typingDot, { backgroundColor: TEXT_GRAY_500 }]} />
                <View style={[styles.typingDot, { backgroundColor: TEXT_GRAY_500 }]} />
              </View>
              <Text style={[styles.typingText, { color: TEXT_GRAY_500 }]}>
                {typingUsers.length === 1 ? `${typingUsers[0]} is ${typingKind === 'recording' ? 'recording a voice message' : 'typing'}` : `${typingUsers.length} people are typing`}
              </Text>
            </View>
          ) : null}

          <Modal
            visible={reactionModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setReactionModalVisible(false)}
          >
            <TouchableOpacity
              style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
              activeOpacity={1}
              onPress={() => setReactionModalVisible(false)}
            />
            <View style={[styles.reactionModalSheet, { backgroundColor: c.background }]}>
              <View style={[styles.reactionModalHeader, { borderBottomColor: BORDER_GRAY }]}>
                <Text style={[styles.reactionModalTitle, { color: TEXT_GRAY_900 }]}>Message options</Text>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionChip} onPress={startReply} activeOpacity={0.8}>
                  <Text style={{ color: TEXT_GRAY_900, fontWeight: '600' }}>↩ Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionChip} onPress={() => { const m = selectedMessageForReaction; closeOptions(); if (m) api.conversations.pinMessage(conversationId!, pinned?.id === m.id ? null : m.id).catch(() => Alert.alert('Error', 'Could not pin')); }} activeOpacity={0.8}>
                  <Text style={{ color: TEXT_GRAY_900, fontWeight: '600' }}>📌 {pinned?.id === selectedMessageForReaction?.id ? 'Unpin' : 'Pin'}</Text>
                </TouchableOpacity>
                {selectedMessageForReaction?.type === 'voice' ? (
                  <TouchableOpacity style={styles.actionChip} onPress={transcribeVoiceMessage} activeOpacity={0.8}>
                    <Text style={{ color: TEXT_GRAY_900, fontWeight: '600' }}>Transcribe voice message</Text>
                  </TouchableOpacity>
                ) : null}
                {selectedMessageForReaction && (selectedMessageForReaction.type === 'text' || !selectedMessageForReaction.type) && !textOf(selectedMessageForReaction).startsWith('sticker:') ? (
                  <TouchableOpacity style={styles.actionChip} onPress={translateMessage} activeOpacity={0.8}>
                    <Text style={{ color: TEXT_GRAY_900, fontWeight: '600' }}>🌐 Translate</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.actionChip} onPress={toggleStar} activeOpacity={0.8}>
                  <Text style={{ color: TEXT_GRAY_900, fontWeight: '600' }}>⭐ {selectedMessageForReaction?.starred ? 'Unstar' : 'Star'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionChip} onPress={startSelect} activeOpacity={0.8}>
                  <Text style={{ color: TEXT_GRAY_900, fontWeight: '600' }}>☑ Select</Text>
                </TouchableOpacity>
                {inGroup && selectedMessageForReaction && isMine(selectedMessageForReaction.sender_id) ? (
                  <TouchableOpacity style={styles.actionChip} onPress={showReaders} activeOpacity={0.8}>
                    <Text style={{ color: TEXT_GRAY_900, fontWeight: '600' }}>👁 Seen by</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.actionChip} onPress={openForward} activeOpacity={0.8}>
                  <Text style={{ color: TEXT_GRAY_900, fontWeight: '600' }}>↪ Forward</Text>
                </TouchableOpacity>
                {selectedMessageForReaction && !isMine(selectedMessageForReaction.sender_id) ? (
                  <TouchableOpacity style={styles.actionChip} onPress={() => { const id = selectedMessageForReaction.id; closeOptions(); setReport({ type: 'message', id }); }} activeOpacity={0.8}>
                    <Text style={{ color: c.danger, fontWeight: '600' }}>⚑ Report</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.actionChip} onPress={() => deleteMessage('me')} activeOpacity={0.8} disabled={sending}>
                  <Text style={{ color: c.danger, fontWeight: '600' }}>Delete for me</Text>
                </TouchableOpacity>
              </View>
              {selectedMessageForReaction && isMine(selectedMessageForReaction.sender_id) ? (
                <>
                  {selectedMessageForReaction.type === 'text' || !selectedMessageForReaction.type ? (
                    <View style={[styles.reactionModalSection, { borderBottomColor: BORDER_GRAY }]}>
                      <Text style={[styles.reactionModalSectionTitle, { color: TEXT_GRAY_500 }]}>Edit Message</Text>
                      <TextInput
                        value={editMessageText}
                        onChangeText={setEditMessageText}
                        placeholder={textOf(selectedMessageForReaction)}
                        placeholderTextColor={TEXT_GRAY_500}
                        style={[styles.reactionEditInput, { color: TEXT_GRAY_900 }]}
                      />
                      <TouchableOpacity
                        style={[styles.reactionModalAction, { backgroundColor: X_BLUE }]}
                        onPress={() => editMessage(editMessageText || textOf(selectedMessageForReaction))}
                        activeOpacity={0.8}
                        disabled={sending}
                      >
                        <Text style={[styles.reactionModalActionText, { color: '#FFFFFF' }]}>{sending ? 'Saving...' : 'Save'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  <View style={[styles.reactionModalSection, { borderBottomColor: BORDER_GRAY }]}>
                    <TouchableOpacity
                      style={[styles.reactionModalAction, { backgroundColor: c.danger }]}
                      onPress={() => deleteMessage('all')}
                      activeOpacity={0.8}
                      disabled={sending}
                    >
                      <Text style={[styles.reactionModalActionText, { color: '#FFFFFF' }]}>{sending ? 'Deleting...' : 'Delete for everyone'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.reactionModalDivider, { backgroundColor: BORDER_GRAY }]} />
                </>
              ) : null}
              <View style={[styles.reactionModalSection, { borderBottomColor: BORDER_GRAY }]}>
                <Text style={[styles.reactionModalSectionTitle, { color: TEXT_GRAY_500 }]}>React with</Text>
              </View>
              <View style={styles.reactionEmojisRow}>
                {reactionEmojis.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionEmojiBtn}
                    onPress={() => toggleReaction(emoji)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.reactionEmojiText, { fontSize: 26 }]}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Modal>

          {replyTo ? (
            <View style={[styles.replyBar, { backgroundColor: BG_GRAY, borderTopColor: BORDER_GRAY }]}>
              <View style={[styles.replyAccent, { backgroundColor: X_BLUE }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: X_BLUE, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  Replying to {isMine(replyTo.sender_id) ? 'yourself' : replyTo.sender_name || ''}
                </Text>
                <Text style={{ color: TEXT_GRAY_500, fontSize: 13 }} numberOfLines={1}>
                  {replyTo.type === 'image' ? '📷 Photo' : replyTo.type === 'voice' ? '🎤 Voice message' : replyTo.type === 'file' ? '📎 File' : textOf(replyTo)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: TEXT_GRAY_500, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {pinned ? (
            <View style={[styles.replyBar, { backgroundColor: BG_GRAY, borderTopColor: BORDER_GRAY }]}>
              <Text>📌</Text>
              <Text style={{ flex: 1, color: TEXT_GRAY_900 }} numberOfLines={1}>
                {pinned.type === 'image' ? '📷 Photo' : pinned.type === 'voice' ? '🎤 Voice message' : pinned.type === 'file' ? '📎 File' : textOf({ content: pinned.content })}
              </Text>
            </View>
          ) : null}

          {meta.disappear ? (
            <Text style={{ color: TEXT_GRAY_500, fontSize: 12, textAlign: 'center', paddingVertical: 2, backgroundColor: c.background }}>
              ⏱ New messages disappear after {DISAPPEAR_OPTIONS.find((o) => o[1] === meta.disappear)?.[0] || ''}
            </Text>
          ) : null}

          <View style={[styles.inputContainer, { backgroundColor: c.background }]}>
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={openAttachmentMenu} activeOpacity={0.8}>
                <Icon name="imageFeather" size={20} color={X_BLUE} />
              </TouchableOpacity>
              {recording ? (
                <>
                  <TouchableOpacity style={styles.voiceBtn} onPress={cancelRecording} activeOpacity={0.8} hitSlop={8}>
                    <Icon name="trash" size={20} color={c.danger} />
                  </TouchableOpacity>
                  <View style={[styles.voiceTimer, { flex: 1, justifyContent: 'center' }]}>
                    <RecordingDot color={c.danger} />
                    <Text style={styles.voiceTimerText}>{fmtSecs(recordingDuration)}</Text>
                    <View style={styles.liveBars}>
                      {liveLevels.length ? liveLevels.map((l, i) => (
                        <View key={i} style={[styles.liveBar, { height: 4 + l * 22, backgroundColor: cancelHint ? c.danger : c.primary }]} />
                      )) : <Text style={{ color: TEXT_GRAY_500, fontSize: 13 }}>{holdModeRef.current ? (cancelHint ? 'Release to cancel' : '◀ Slide to cancel') : 'Recording…'}</Text>}
                    </View>
                  </View>
                  {holdModeRef.current ? null : (
                    <TouchableOpacity style={[styles.sendBtn, styles.sendBtnActive]} onPress={stopRecording} activeOpacity={0.8}>
                      <Icon name="check" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.voiceBtn} {...micPan.panHandlers}>
                    <Icon name="mic" size={20} color={X_BLUE} />
                  </View>
                  <TextInput
                    value={input}
                    onChangeText={onChangeInput}
                    style={[styles.input, { color: TEXT_GRAY_900, flex: 1 }]}
                    placeholder="Start a message..."
                    placeholderTextColor={TEXT_GRAY_500}
                    multiline
                    underlineColorAndroid="transparent"
                  />
                  {input.trim() ? (
                    <TouchableOpacity style={[styles.sendBtn, !sending ? styles.sendBtnActive : styles.sendBtnDisabled]} onPress={sendMessage} disabled={sending} activeOpacity={0.8}>
                      <Icon name="sendFeather" size={20} color={'#FFFFFF'} />
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          </View>
          {recordingUri ? (
            <View style={styles.previewRow}>
              <TouchableOpacity onPress={() => setRecordingUri(null)} activeOpacity={0.8} style={styles.previewCancel} hitSlop={8}>
                <Icon name="trash" size={20} color={c.danger} />
              </TouchableOpacity>
              <VoiceBubble uri={recordingUri} durationLabel={fmtSecs(recordingDuration)} waveform={recWaveform} isOwn seed={recordingUri} />
              <TouchableOpacity style={[styles.sendBtn, styles.sendBtnActive]} onPress={sendVoiceMessage} disabled={uploading} activeOpacity={0.8}>
                <Icon name="sendFeather" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
      <ImageViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
      <Modal visible={stickerOpen} transparent animationType="slide" onRequestClose={() => setStickerOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setStickerOpen(false)} />
        <View style={{ backgroundColor: c.background, padding: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingBottom: 30 }}>
          {STICKERS.map((e) => (
            <TouchableOpacity key={e} onPress={() => sendSticker(e)} style={{ padding: 6 }}>
              <Text style={{ fontSize: 40 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
      <OptionSheet
        visible={scheduleMenu === 'when'}
        title={input.trim() ? 'Send the typed message…' : 'Type a message first'}
        options={[
          { label: 'In 1 hour', onPress: () => schedule(new Date(Date.now() + 3600 * 1000)) },
          { label: 'Today 9:00 PM', onPress: () => schedule(at(0, 21)) },
          { label: 'Tomorrow 9:00 AM', onPress: () => schedule(at(1, 9)) },
          { label: 'Tomorrow 6:00 PM', onPress: () => schedule(at(1, 18)) },
        ]}
        onClose={() => setScheduleMenu(null)}
      />
      <OptionSheet
        visible={scheduleMenu === 'list'}
        title={scheduledList.length ? 'Tap one to cancel it' : 'Nothing scheduled here'}
        options={scheduledList.map((s) => ({
          label: `${new Date(s.send_at).toLocaleString()} · ${s.content.startsWith('e2ee:') ? '🔒 encrypted message' : s.content.slice(0, 30)}`,
          danger: true,
          onPress: () => api.messages.cancelScheduled(s.id).catch(() => {}),
        }))}
        onClose={() => setScheduleMenu(null)}
      />
      <ReportSheet target={report} onClose={() => setReport(null)} />
      <OptionSheet visible={menu === 'main'} title="Conversation" options={mainMenu} onClose={() => setMenu(null)} />
      <OptionSheet
        visible={menu === 'mute'}
        title="Mute notifications"
        options={[['For 1 hour', 1], ['For 1 day', 24], ['For 1 week', 168], ['Until I turn it back on', -1]].map(([label, h]) => ({ label: label as string, onPress: () => setMute(h as number) }))}
        onClose={() => setMenu(null)}
      />
      <OptionSheet
        visible={menu === 'disappear'}
        title="Disappearing messages (new messages only)"
        options={DISAPPEAR_OPTIONS.map(([label, secs]) => ({ label, selected: (meta.disappear || 0) === secs, onPress: () => setDisappear(secs) }))}
        onClose={() => setMenu(null)}
      />
      <OptionSheet
        visible={menu === 'forward'}
        title="Forward to…"
        options={forwardList.slice(0, 12).map((cv) => ({ label: getChatName(cv), onPress: () => forwardTo(cv) }))}
        onClose={() => setMenu(null)}
      />
      {showJump ? (
        <TouchableOpacity activeOpacity={0.85} onPress={jumpToLatest} style={[styles.jumpBtn, { backgroundColor: c.card, shadowColor: c.shadow }]}>
          <Text style={{ color: X_BLUE, fontSize: 18, fontWeight: '800' }}>↓</Text>
          {newCount > 0 ? <View style={[styles.jumpBadge, { backgroundColor: X_BLUE }]}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{newCount > 99 ? '99+' : newCount}</Text></View> : null}
        </TouchableOpacity>
      ) : null}

      <OptionSheet visible={menu === 'readers'} title={readersInfo?.title || 'Seen by'} options={(readersInfo?.rows || []).map((label) => ({ label, onPress: () => {} }))} onClose={() => setMenu(null)} />

      <Modal visible={pollOpen} transparent animationType="slide" onRequestClose={() => setPollOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPollOpen(false)} />
        <View style={[styles.sheetBox, { backgroundColor: c.card }]}>
          <Text style={[styles.sheetTitle, { color: TEXT_GRAY_900 }]}>Create a poll</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
            <TextInput value={pollQuestion} onChangeText={setPollQuestion} placeholder="Question" placeholderTextColor={TEXT_GRAY_500} maxLength={200} style={[styles.pollInput, { color: TEXT_GRAY_900, backgroundColor: c.inputBg }]} />
            {pollOptions.map((o, i) => (
              <TextInput key={i} value={o} onChangeText={(t) => setPollOptions((prev) => prev.map((x, j) => (j === i ? t : x)))} placeholder={`Option ${i + 1}`} placeholderTextColor={TEXT_GRAY_500} maxLength={120} style={[styles.pollInput, { color: TEXT_GRAY_900, backgroundColor: c.inputBg }]} />
            ))}
            {pollOptions.length < 6 ? (
              <TouchableOpacity onPress={() => setPollOptions((p) => [...p, ''])} style={{ paddingVertical: 8 }}><Text style={{ color: X_BLUE, fontWeight: '700' }}>+ Add option</Text></TouchableOpacity>
            ) : null}
          </ScrollView>
          <View style={styles.sheetButtons}>
            <TouchableOpacity onPress={() => setPollOpen(false)} style={[styles.sheetBtn, { backgroundColor: c.inputBg }]}><Text style={{ color: TEXT_GRAY_500, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={createPoll} style={[styles.sheetBtn, { backgroundColor: X_BLUE, flex: 2 }]}><Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Send poll</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={themeOpen} transparent animationType="slide" onRequestClose={() => setThemeOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setThemeOpen(false)} />
        <View style={[styles.sheetBox, { backgroundColor: c.card }]}>
          <Text style={[styles.sheetTitle, { color: TEXT_GRAY_900 }]}>Chat theme</Text>
          <Text style={[styles.sheetLabel, { color: TEXT_GRAY_500 }]}>Wallpaper</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {WALLPAPERS.map((w) => (
              <TouchableOpacity key={w.name} onPress={() => setThemeDraft((d) => ({ ...d, wallpaper: w.color }))} style={[styles.swatch, { backgroundColor: w.color || c.background, borderColor: themeDraft.wallpaper === w.color ? X_BLUE : c.border, borderWidth: themeDraft.wallpaper === w.color ? 3 : 1 }]}>
                {w.color === null ? <Text style={{ color: TEXT_GRAY_500, fontSize: 11 }}>Auto</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[styles.sheetLabel, { color: TEXT_GRAY_500 }]}>My bubble color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {BUBBLE_COLORS.map((b) => (
              <TouchableOpacity key={b.name} onPress={() => setThemeDraft((d) => ({ ...d, bubble: b.color }))} style={[styles.swatch, { backgroundColor: b.color || X_BLUE, borderColor: themeDraft.bubble === b.color ? TEXT_GRAY_900 : 'transparent', borderWidth: 3 }]}>
                {b.color === null ? <Text style={{ color: '#FFFFFF', fontSize: 11 }}>Auto</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={[styles.previewWall, { backgroundColor: themeDraft.wallpaper || c.background }]}>
            <View style={[styles.previewBubble, { backgroundColor: c.card, alignSelf: 'flex-start' }]}><Text style={{ color: TEXT_GRAY_900 }}>Hello 👋</Text></View>
            <View style={[styles.previewBubble, { backgroundColor: themeDraft.bubble || X_BLUE, alignSelf: 'flex-end' }]}><Text style={{ color: '#FFFFFF' }}>Hi! This is my color</Text></View>
          </View>
          <TouchableOpacity onPress={() => setThemeAll((v) => !v)} style={styles.themeAllRow} activeOpacity={0.8}>
            <Text style={{ color: X_BLUE, fontSize: 18 }}>{themeAll ? '☑' : '☐'}</Text>
            <Text style={{ color: TEXT_GRAY_900, marginLeft: 8 }}>Use for all my chats</Text>
          </TouchableOpacity>
          <View style={styles.sheetButtons}>
            <TouchableOpacity onPress={() => setThemeOpen(false)} style={[styles.sheetBtn, { backgroundColor: c.inputBg }]}><Text style={{ color: TEXT_GRAY_500, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={async () => { await saveTheme(conversationId!, themeDraft, themeAll); setTheme(themeDraft); setThemeOpen(false); }} style={[styles.sheetBtn, { backgroundColor: X_BLUE, flex: 2 }]}><Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <AIAssistantSheet visible={aiOpen} onClose={() => setAiOpen(false)} context={aiContext} isGroup={inGroup} />
    </SafeAreaView>
  );
}

const makeStyles = (c: any, k: any) => {
  const { X_BLUE, BG_GRAY, BORDER_GRAY, TEXT_GRAY_900, TEXT_GRAY_500, TEXT_GRAY_400 } = k;
  return StyleSheet.create({
  selectBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52, marginHorizontal: 12, marginTop: 6, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  selectBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  jumpBtn: { position: 'absolute', right: 16, bottom: 92, width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  jumpBadge: { position: 'absolute', top: -8, right: -6, minWidth: 22, height: 22, borderRadius: 8, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  sheetBox: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 28 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  sheetLabel: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  sheetButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetBtn: { flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pollInput: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 8 },
  swatch: { width: 46, height: 46, borderRadius: 15, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  previewWall: { marginTop: 14, borderRadius: 18, padding: 12, gap: 8 },
  previewBubble: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  themeAllRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  forwardedLabel: { fontSize: 12, fontStyle: 'italic', marginBottom: 2 },
  quote: { borderLeftWidth: 3, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 4 },
  quoteName: { fontSize: 12, fontWeight: '700' },
  quoteText: { fontSize: 13 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1 },
  replyAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  actionChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: BG_GRAY, borderWidth: 1, borderColor: BORDER_GRAY },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 66,
    marginBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.divider,
  },
  backWrap: { padding: 6 },
  headerInfo: { flex: 1, minWidth: 0, marginLeft: 10, flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { marginRight: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 14, fontWeight: '700' },
  nameWrap: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_GRAY_900,
    marginRight: 6,
  },
  phone: { fontSize: 13, color: TEXT_GRAY_500 },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  searchWrap: {
    paddingHorizontal: 14,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_GRAY_900,
    paddingHorizontal: 8,
  },
  listContent: { paddingVertical: 10, paddingHorizontal: 14, flexGrow: 1 },
  messageWrap: { marginHorizontal: 4, marginVertical: 5 },
  ownWrap: { alignItems: 'flex-end' },
  otherWrap: { alignItems: 'flex-start' },
  bubbleContainer: {
    maxWidth: '80%',
  },
  bubbleContainerOwn: { alignSelf: 'flex-end' },
  bubbleContainerOther: { alignSelf: 'flex-start' },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: X_BLUE,
    borderBottomRightRadius: 7,
  },
  otherBubble: {
    backgroundColor: c.card,
    borderBottomLeftRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  messageText: { ...Typography.body, lineHeight: 22 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 5,
  },
  metaRowOwn: { justifyContent: 'flex-end' },
  metaRowOther: { justifyContent: 'flex-start' },
  time: { ...Typography.caption },
  statusWrap: { marginLeft: 4 },
  typingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typingDots: { flexDirection: 'row', gap: 4 },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: TEXT_GRAY_500,
  },
  typingText: { ...Typography.bodySmall },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    ...Typography.h3,
    color: TEXT_GRAY_900,
    marginBottom: 6,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: TEXT_GRAY_500,
    textAlign: 'center',
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    paddingHorizontal: 4,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: c.inputBg,
  },
  reactionMy: {
    backgroundColor: c.primaryLight,
    borderWidth: 1,
    borderColor: c.primary,
  },
  reactionEmoji: { fontSize: 14, marginRight: 2 },
  reactionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_GRAY_500,
  },
  reactionMyCount: { color: X_BLUE },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  reactionModalSheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    maxHeight: '35%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  reactionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  reactionModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_GRAY_900,
  },
  reactionEmojisRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  reactionEmojiBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  reactionEmojiText: { fontSize: 28 },
  reactionModalSection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginHorizontal: 16,
  },
  reactionModalSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_GRAY_500,
    marginBottom: 8,
    marginLeft: 0,
  },
  reactionEditInput: {
    fontSize: 16,
    color: TEXT_GRAY_900,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: c.inputBorder,
    borderRadius: BorderRadius.input,
    marginBottom: 12,
  },
  reactionModalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: BorderRadius.button,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  reactionModalActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  reactionModalDivider: {
    height: 1,
    backgroundColor: BORDER_GRAY,
    marginVertical: 4,
  },
  voiceBubble: {
    maxWidth: '75%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  ownVoiceBubble: {
    backgroundColor: X_BLUE,
    borderBottomRightRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  otherVoiceBubble: {
    backgroundColor: c.card,
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  voiceContent: { flexDirection: 'row', alignItems: 'center' },
  voiceDurationWrap: { marginLeft: 8, alignItems: 'center' },
  voiceDurationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    backgroundColor: BG_GRAY,
  },
  voiceBtnText: { fontSize: 20, color: '#FFFFFF' },
  liveBars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 10, height: 30, flex: 1, overflow: 'hidden' },
  liveBar: { width: 3, borderRadius: 2 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 12, paddingBottom: 8 },
  previewCancel: { padding: 8 },
  voiceTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  voiceTimerText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_GRAY_900,
  },
  voicePreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG_GRAY,
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  voicePreview: { flexDirection: 'row', alignItems: 'center' },
  voicePreviewText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  voicePreviewCancel: { marginLeft: 8 },
  voicePreviewCancelText: { fontSize: 16 },
  inputContainer: { flexDirection: 'column' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 26,
    backgroundColor: c.card,
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  attachBtn: {
    padding: 8,
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: TEXT_GRAY_900,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    borderRadius: 25,
    borderWidth: 0,
    minHeight: 40,
    maxHeight: 120,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnActive: {
    backgroundColor: X_BLUE,
  },
  sendBtnDisabled: {
    backgroundColor: c.disabledBtn,
  },
  fileBubble: {
    maxWidth: '75%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  ownFileBubble: {
    backgroundColor: X_BLUE,
    borderBottomRightRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  otherFileBubble: {
    backgroundColor: c.card,
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  fileContent: { flexDirection: 'row', alignItems: 'center' },
  fileInfo: { marginLeft: 8 },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingWrap: {
    padding: 16,
    alignItems: 'center',
  },
  msgAvatar: {
    width: 22,
    height: 22,
    borderRadius: 8,
  },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 2 },
  senderName: { fontSize: 12, fontWeight: '700', maxWidth: 200 },
  dayWrap: { alignItems: 'center', marginVertical: 12 },
  dayText: { fontSize: 12, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
});
};
