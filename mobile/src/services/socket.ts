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
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  // Re-join the open conversation rooms after every (re)connect
  socket.on('connect', () => rooms.forEach((id) => socket?.emit('join_conversation', id)));
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
  currentToken = null;
  rooms.clear();
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

/** Subscribe to a socket event; returns the unsubscribe function. Safe to call before connecting. */
export const onSocket = (event: string, handler: (...args: any[]) => void): (() => void) => {
  let attached: Socket | null = null;
  const attach = () => {
    if (socket && socket !== attached) {
      attached?.off(event, handler);
      attached = socket;
      attached.on(event, handler);
    }
  };
  attach();
  const timer = setInterval(attach, 1000); // picks up a socket created after subscribing
  return () => {
    clearInterval(timer);
    attached?.off(event, handler);
  };
};
