import io from 'socket.io-client';
type Socket = ReturnType<typeof io>;
import { API_BASE } from '../config';

/**
 * One authenticated socket for the whole app (the server identifies the user from the JWT,
 * so no `authenticate` event is needed). Screens subscribe with `onSocket`.
 */
let socket: Socket | null = null;
let currentToken: string | null = null;
const rooms = new Set<string | number>();

export const connectSocket = (token: string): Socket => {
  if (socket && currentToken === token) return socket;
  disconnectSocket();
  currentToken = token;
  socket = io(API_BASE, {
    transports: ['websocket', 'polling'],
    auth: { token },
    // React Native forwards extraHeaders on both polling and WebSocket handshakes.
    extraHeaders: { skip_zrok_interstitial: '1' },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  // Re-join the open conversation rooms after every (re)connect
  socket.on('connect', () => rooms.forEach((id) => socket?.emit('join_conversation', id)));
  subs.forEach(attachSub); // screens that subscribed before this socket existed
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
  }
  socket = null;
  currentToken = null;
  rooms.clear();
  subs.forEach((sub) => { sub.attached = null; });
};

export const getSocket = (): Socket | null => socket;

export const joinConversation = (id: string | number) => {
  rooms.add(id);
  if (socket?.connected) socket.emit('join_conversation', id);
};

export const leaveConversation = (id: string | number) => {
  rooms.delete(id);
  socket?.emit('leave_conversation', id);
};

export const emitTyping = (conversationId: string | number, isTyping: boolean, kind: 'typing' | 'recording' = 'typing') => {
  socket?.emit('typing', { conversationId, isTyping, kind });
};

// Every active subscription. When a socket is created they are attached to it right away, so there is no per-subscription
// polling timer (before, each onSocket call ran a 1 second setInterval for as long as the screen was mounted).
interface Sub { event: string; handler: (...args: any[]) => void; attached: Socket | null }
const subs = new Set<Sub>();
const attachSub = (sub: Sub) => {
  if (socket && socket !== sub.attached) {
    sub.attached?.off(sub.event, sub.handler);
    sub.attached = socket;
    socket.on(sub.event, sub.handler);
  }
};

/** Subscribe to a socket event; returns the unsubscribe function. Safe to call before connecting. */
export const onSocket = (event: string, handler: (...args: any[]) => void): (() => void) => {
  const sub: Sub = { event, handler, attached: null };
  subs.add(sub);
  attachSub(sub);
  return () => {
    subs.delete(sub);
    sub.attached?.off(event, handler);
    sub.attached = null;
  };
};
