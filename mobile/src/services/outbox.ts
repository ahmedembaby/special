import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as api from './api';

/**
 * Offline outbox: messages that could not be sent (no connection / server down) are stored on the device and
 * retried automatically. Every item carries a client_id, the server stores a message only once per client_id,
 * so a retry after a lost response never creates a duplicate.
 */
export interface OutboxItem {
  clientId: string;
  conversationId: string | number;
  kind: 'text' | 'upload';
  content?: string;
  replyTo?: string | number | null;
  file?: { uri: string; type?: string; name?: string };
  voice_duration?: string;
  voice_waveform?: string;
  view_once?: boolean;
  createdAt: string;
  failed?: boolean;
}

type Event =
  | { type: 'sent'; clientId: string; message: api.Message }
  | { type: 'failed'; clientId: string }
  | { type: 'queued'; clientId: string }
  | { type: 'removed'; clientId: string };

const KEY = 'outbox:v1';
const listeners = new Set<(e: Event) => void>();
const emit = (e: Event) => listeners.forEach((l) => { try { l(e); } catch { /* listener errors must not stop the queue */ } });
export const subscribeOutbox = (fn: (e: Event) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

let cache: OutboxItem[] | null = null;
const load = async (): Promise<OutboxItem[]> => {
  if (cache) return cache;
  try { cache = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); } catch { cache = []; }
  return cache!;
};
const persist = async () => { try { await AsyncStorage.setItem(KEY, JSON.stringify(cache || [])); } catch { /* storage full: the in-memory queue still works */ } };

export const newClientId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** True when the failure means "try again later" (no connection, timeout, server error), not "the server said no". */
export const isRetryable = (e: any): boolean => {
  const status = e?.response?.status;
  if (!e?.response) return true;
  return status >= 500 || status === 408 || status === 429;
};

export const outboxFor = async (conversationId: string | number) =>
  (await load()).filter((i) => String(i.conversationId) === String(conversationId));

export const enqueue = async (item: OutboxItem) => {
  const list = await load();
  if (list.some((i) => i.clientId === item.clientId)) return;
  list.push(item);
  await persist();
  emit({ type: 'queued', clientId: item.clientId });
  scheduleRetry(8000);
};

export const removeFromOutbox = async (clientId: string) => {
  const list = await load();
  const i = list.findIndex((x) => x.clientId === clientId);
  if (i >= 0) { list.splice(i, 1); await persist(); }
  emit({ type: 'removed', clientId });
};

const sendItem = (it: OutboxItem) =>
  it.kind === 'text'
    ? api.messages.send({ conversation_id: it.conversationId, content: it.content || '', reply_to: it.replyTo || undefined, client_id: it.clientId })
    : api.messages.upload({
        conversation_id: it.conversationId, file: it.file, reply_to: it.replyTo || undefined, voice_duration: it.voice_duration,
        voice_waveform: it.voice_waveform, view_once: it.view_once, client_id: it.clientId,
      });

let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleRetry = (ms: number) => {
  if (retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; flushOutbox(); }, ms);
};

/** Sends everything in order. Stops at the first retryable error (still offline) and tries again later. */
export const flushOutbox = async () => {
  if (flushing) return;
  flushing = true;
  try {
    const list = await load();
    for (const it of [...list]) {
      if (it.failed) continue;
      try {
        const res = await sendItem(it);
        await removeFromOutbox(it.clientId);
        emit({ type: 'sent', clientId: it.clientId, message: res.data });
      } catch (e) {
        if (isRetryable(e)) { scheduleRetry(15000); break; }
        it.failed = true; // rejected (blocked, not a member...): keep it visible as "not sent", never retry
        await persist();
        emit({ type: 'failed', clientId: it.clientId });
      }
    }
  } finally {
    flushing = false;
  }
};

let netUnsub: (() => void) | null = null;
/** Call once after login: flushes now, whenever the connection comes back, and every minute as a safety net. */
export const startOutbox = () => {
  if (netUnsub) return;
  flushOutbox();
  let was = true;
  const unsub = NetInfo.addEventListener((s) => {
    const online = !!s.isConnected && s.isInternetReachable !== false;
    if (online && !was) flushOutbox();
    was = online;
  });
  const timer = setInterval(() => { load().then((l) => { if (l.some((i) => !i.failed)) flushOutbox(); }); }, 60000);
  netUnsub = () => { unsub(); clearInterval(timer); };
};

export const stopOutbox = () => {
  netUnsub?.(); netUnsub = null;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  cache = null; // next login starts from its own stored queue
};

/** Retry a failed item right now (resets the failed flag). */
export const retryItem = async (clientId: string) => {
  const list = await load();
  const it = list.find((i) => i.clientId === clientId);
  if (it) { it.failed = false; await persist(); emit({ type: 'queued', clientId }); }
  flushOutbox();
};
