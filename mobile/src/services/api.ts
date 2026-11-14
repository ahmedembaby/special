import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { API_URL } from '../config';

const api: AxiosInstance = axios.create({ baseURL: API_URL, timeout: 15000 });

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('echat_token');
  // zrok: bypass the interstitial page so API requests reach the app server directly.
  config.headers.set('skip_zrok_interstitial', '1');
  config.headers['X-Device-Name'] = Device.deviceName || Device.modelName || 'Mobile device';
  config.headers['X-Device-Platform'] = Platform.OS;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthCall = url.startsWith('/auth/');
    if (err.response?.status === 401 && !isAuthCall && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(err);
  }
);

export interface SignupData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface OTPOptions {
  phone: string;
  code?: string;
}

export interface AuthUser {
  id: number | string;
  name: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  bio?: string | null;
  is_admin?: boolean;
  is_private?: boolean;
  public_key?: string | null;
}

export interface MessageFile {
  url: string;
  name: string;
  size: number;
}

export interface Conversation {
  id: string | number;
  name?: string;
  type?: 'direct' | 'group';
  avatar?: string | null;
  group_id?: number | string | null;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  pinned_message?: { id: string | number; content: string; type: string; sender_name?: string } | null;
  disappear_after?: number | null;
  unread_count?: number;
  participants?: Array<{ id: string | number; name?: string; username?: string | null; avatar?: string | null; status?: string; last_seen?: string | null; public_key?: string | null }>;
  last_message?: string;
  last_message_type?: 'text' | 'image' | 'file' | 'voice' | 'poll';
  last_message_at?: string;
  last_message_sender_id?: number | string;
}

export interface Message {
  id: string | number;
  conversation_id: string | number;
  sender_id: string | number;
  content: string;
  type?: 'text' | 'image' | 'file' | 'voice' | 'poll';
  file_url?: string;
  file_uri?: string;
  file_name?: string;
  file_size?: number;
  voice_duration?: string;
  voice_waveform?: string | null;
  sender_name?: string;
  sender_avatar?: string | null;
  /** queued = waiting in the offline outbox, failed = rejected by the server (will not be retried) */
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'queued' | 'failed';
  created_at: string;
  client_id?: string;
  starred?: boolean;
  poll?: Poll;
  edited_at?: string | null;
  read_at?: string;
  reactions?: MessageReaction[];
  reply?: MessageReply | null;
  forwarded?: boolean;
  view_once?: boolean;
  opened?: boolean;
  expires_at?: string | null;
  /** client only: decrypted text of an end-to-end encrypted message */
  plain?: string;
}

export interface PollOption { id: number; text: string; votes: number; my: boolean }
export interface Poll { options: PollOption[]; total: number; my_option: number | null }
export interface LinkPreviewData { url: string; title: string; description: string; image: string | null; site: string }
export interface SearchHit { id: number; conversation_id: number; content: string; created_at: string; sender_id: number; sender_name: string; conversation_name?: string; conversation_avatar?: string | null }
export interface StarredMessage { id: number; conversation_id: number; content: string; type: string; file_url?: string | null; voice_duration?: string | null; created_at: string; starred_at: string; sender_id: number; sender_name: string; sender_avatar?: string | null; conversation_name?: string }

export interface MessageReply {
  id: string | number;
  deleted?: boolean;
  content?: string;
  type?: string;
  sender_id?: string | number;
  sender_name?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  user_id: string | number;
  user_name?: string;
  user_avatar?: string;
  created_at?: string;
  my_reaction?: boolean;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: Array<{ id: string | number; name: string; avatar?: string }>;
  my_reaction?: boolean;
}

export interface User {
  id: string | number;
  name: string;
  email?: string;
  phone?: string;
  username?: string | null;
  avatar?: string | null;
  bio?: string | null;
  status?: string;
}

export const auth = {
  signup: (data: SignupData) => api.post('/auth/signup', data),
  login: (data: LoginData) => api.post('/auth/login', data),
  sendOTP: (data: { phone: string }) => api.post('/auth/send-otp', data),
  resendOTP: (data: { phone: string }) => api.post('/auth/resend-otp', data),
  verifyOTP: (data: OTPOptions) => api.post('/auth/verify-otp', data),
  // registrationToken comes from verify-otp for phone numbers that have no account yet
  setName: (data: { registrationToken: string; name: string }) => api.post('/auth/set-name', data),
  logout: () => api.post('/auth/logout'),
  pushRegister: (data: { token: string }) => api.post('/auth/push/register', data),
  sessions: () => api.get<DeviceSession[]>('/auth/sessions'),
  revokeSession: (id: string) => api.delete<{ revoked: boolean; current: boolean }>(`/auth/sessions/${encodeURIComponent(id)}`),
};

export interface DeviceSession { id: string; device_name: string; platform: string; created_at: string; last_active_at: string; expires_at: string; is_current: boolean; }

export interface UserSettings {
  hide_presence: boolean;
  read_receipts: boolean;
  who_can_message: 'everyone' | 'followed' | 'nobody';
  notif: { like: boolean; comment: boolean; follow: boolean; mention: boolean; message: boolean; group: boolean };
  quiet: { enabled: boolean; start: number; end: number; tz?: number };
  digest: { enabled: boolean; hour: number };
}

export const users = {
  list: () => api.get<User[]>('/users'),
  get: (id: string | number) => api.get<User>(`/users/${id}`),
  me: () => api.get<AuthUser>('/users/me'),
  updateMe: (data: { name?: string; bio?: string; username?: string; is_private?: boolean }) => api.put<AuthUser>('/users/me', data),
  getSettings: () => api.get<UserSettings>('/users/me/settings'),
  putSettings: (data: Partial<UserSettings>) => api.put<UserSettings>('/users/me/settings', data),
  getKeyBackup: () => api.get<{ backup: string }>('/users/me/key-backup'),
  putKeyBackup: (backup: string) => api.put('/users/me/key-backup', { backup }),
  setPublicKey: (public_key: string) => api.put('/users/me/key', { public_key }),
  lookupPhones: (phones: string[]) => api.post<Array<User & { phone_tail: string }>>('/users/lookup-phones', { phones }),
  updateAvatar: (formData: FormData) =>
    api.put('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    }),
};

export const conversations = {
  list: () => api.get<Conversation[]>('/conversations'),
  get: (id: string | number) => api.get<Conversation>(`/conversations/${id}`),
  create: (data: { name?: string; type: string; participantIds: Array<string | number> }) =>
    api.post<Conversation>('/conversations', data),
  pin: (id: string | number) => api.put<Conversation>(`/conversations/${id}/pin`),
  messages: (id: string | number, limit?: number, offset?: number) =>
    api.get<{ messages: Message[]; hasMore: boolean }>(`/conversations/${id}/messages`, { params: { limit, offset } }),
  search: (id: string | number, q: string) => api.get<{ messages: Message[] }>(`/conversations/${id}/search`, { params: { q } }),
  /** hours: -1 = until turned off, 0 = unmute */
  archive: (id: string | number) => api.put<Conversation>(`/conversations/${id}/archive`),
  remove: (id: string | number) => api.delete<{ removed: boolean }>(`/conversations/${id}`),
  pinMessage: (id: string | number, messageId: string | number | null) => api.put(`/conversations/${id}/pin-message`, { message_id: messageId }),
  mute: (id: string | number, hours: number) => api.put<Conversation>(`/conversations/${id}/mute`, { hours }),
  disappearing: (id: string | number, seconds: number) => api.put<Conversation>(`/conversations/${id}/disappearing`, { seconds }),
};

export const ai = {
  assistant: (data: { task: 'summarize' | 'suggest_replies' | 'translate' | 'answer' | 'moderate' | 'search_terms'; context: string; prompt?: string; language?: string }) =>
    api.post<{ result: string; usage?: { total_tokens?: number } | null }>('/ai/assistant', data, { timeout: 45000 }),
  transcribeMessage: (messageId: string | number) =>
    api.post<{ text: string }>(`/ai/transcribe/${encodeURIComponent(String(messageId))}`, {}, { timeout: 65000 }),
};

export const messages = {
  send: (data: { conversation_id: string | number; content: string; reply_to?: string | number; client_id?: string }) =>
    api.post<Message>('/messages', data),
  upload: (data: { conversation_id: string | number; file: any; reply_to?: string | number; voice_duration?: string; voice_waveform?: string; view_once?: boolean; client_id?: string }) => {
    const formData = new FormData();
    if (data.client_id) formData.append('client_id', data.client_id);
    if (data.view_once) formData.append('view_once', '1');
    formData.append('conversation_id', String(data.conversation_id));
    if (data.reply_to) formData.append('reply_to', String(data.reply_to));
    if (data.voice_duration) formData.append('voice_duration', data.voice_duration);
    if (data.voice_waveform) formData.append('voice_waveform', data.voice_waveform);
    formData.append('file', {
      uri: data.file.uri,
      type: data.file.type || 'image/jpeg',
      name: data.file.name || 'image.jpg',
    } as any);
    return api.post<Message>('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data', 'X-Conversation-Id': String(data.conversation_id) },
      transformRequest: (data) => data,
    });
  },
  linkPreview: (url: string) => api.get<{ preview: LinkPreviewData | null }>('/messages/link-preview', { params: { url } }),
  searchAll: (q: string) => api.get<{ results: SearchHit[] }>('/messages/search', { params: { q } }),
  starred: () => api.get<{ messages: StarredMessage[] }>('/messages/starred'),
  star: (id: string | number) => api.put(`/messages/${id}/star`),
  unstar: (id: string | number) => api.delete(`/messages/${id}/star`),
  readers: (id: string | number) => api.get<{ readers: Array<{ id: number; name: string; username?: string; avatar?: string | null; read_at: string }>; total: number }>(`/messages/${id}/readers`),
  createPoll: (conversation_id: string | number, question: string, options: string[]) => api.post<Message>('/messages/poll', { conversation_id, question, options }),
  vote: (id: string | number, option_id: number) => api.post<{ poll: Poll }>(`/messages/${id}/vote`, { option_id }),
  openViewOnce: (id: string | number) => api.post<{ file_url: string }>(`/messages/${id}/open`),
  schedule: (conversation_id: string | number, content: string, send_at: string) =>
    api.post<{ id: number; send_at: string }>('/messages/schedule', { conversation_id, content, send_at }),
  scheduled: (conversation_id: string | number) =>
    api.get<Array<{ id: number; content: string; send_at: string }>>('/messages/scheduled', { params: { conversation_id } }),
  cancelScheduled: (id: number) => api.delete(`/messages/scheduled/${id}`),
  translate: (text: string, to: string) => api.get<{ translation: string }>('/translate', { params: { text, to } }),
  markDelivered: (id: string | number) => api.put(`/messages/${id}/delivered`),
  markRead: (id: string | number) => api.put(`/messages/${id}/read`),
  markAllRead: (conversationId: string | number) =>
    api.put(`/messages/conversation/${conversationId}/read-all`),
  getReactions: (messageId: string | number) =>
    api.get<MessageReaction[]>(`/messages/${messageId}/reactions`),
  addReaction: (messageId: string | number, emoji: string) =>
    api.post(`/messages/${messageId}/reactions`, { emoji }),
  removeReaction: (messageId: string | number, emoji: string) =>
    api.delete(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),
  editMessage: (messageId: string | number, content: string) =>
    api.put<Message>(`/messages/${messageId}`, { content }),
  deleteMessage: (messageId: string | number, scope: 'me' | 'all' = 'all') =>
    api.delete(`/messages/${messageId}`, { params: { scope } }),
  forward: (messageId: string | number, targets: Array<{ conversation_id: string | number; content?: string }>) =>
    api.post<{ messages: Message[] }>(`/messages/${messageId}/forward`, { targets }),
};

export default api;

export const safety = {
  block: (userId: string | number) => api.post<{ blocked: boolean }>(`/safety/block/${userId}`),
  blocks: () => api.get<User[]>('/safety/blocks'),
  report: (type: 'user' | 'post' | 'comment' | 'message' | 'story', id: string | number, reason: string, details?: string) =>
    api.post('/safety/report', { type, id: Number(id), reason, details }),
  exportData: () => api.get('/safety/export'),
  deleteAccount: () => api.delete('/safety/account', { data: { confirm: 'DELETE' } }),
};
