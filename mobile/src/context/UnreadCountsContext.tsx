import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import * as api from '../services/api';
import * as social from '../services/social';
import { onSocket } from '../services/socket';

interface UnreadCounts {
  messageCount: number;
  notificationCount: number;
  refresh: () => Promise<void>;
}
const Context = createContext<UnreadCounts>({ messageCount: 0, notificationCount: 0, refresh: async () => {} });

export const UnreadCountsProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  const [messageCount, setMessageCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) {
      setMessageCount(0);
      setNotificationCount(0);
      return;
    }
    const [chats, notifications] = await Promise.allSettled([
      api.conversations.list(),
      social.unreadNotificationCount(),
    ]);
    if (chats.status === 'fulfilled') {
      const total = (chats.value.data || []).reduce((sum, item) => sum + Math.max(0, Number(item.unread_count) || 0), 0);
      setMessageCount(total);
    }
    if (notifications.status === 'fulfilled') setNotificationCount(Math.max(0, Number(notifications.value) || 0));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setMessageCount(0);
      setNotificationCount(0);
      return;
    }
    refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refresh(), 300);
    };
    const offs = [
      onSocket('conversation_message', scheduleRefresh),
      onSocket('conversation_read', scheduleRefresh),
      onSocket('conversation_updated', scheduleRefresh),
      onSocket('conversation_removed', scheduleRefresh),
      onSocket('notification', scheduleRefresh),
    ];
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleRefresh();
    });
    return () => {
      offs.forEach((off) => off());
      appState.remove();
      if (timer) clearTimeout(timer);
    };
  }, [token, refresh]);

  const value = useMemo(() => ({ messageCount, notificationCount, refresh }), [messageCount, notificationCount, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useUnreadCounts = () => useContext(Context);
