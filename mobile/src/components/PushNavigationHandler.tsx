import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { navigationRef } from '../navigation/ref';
import { syncPushToken } from '../services/notifications';

type PushData = Record<string, any> | undefined;

/** Maps the data of a received push to a screen. Calls are handled by their own contexts. */
const routeFor = (data: PushData): (() => void) | null => {
  if (!data || data.type === 'call' || data.type === 'group_call') return null;
  const go = (name: string, params?: any) => () => navigationRef.navigate(name as never, params as never);
  const openChat = (conversationId: any) => go('Messages', { screen: 'Chat', params: { conversationId } });

  if (data.type === 'notification') {
    const kind = data.notificationType;
    if (kind === 'follow' || kind === 'follow_request' || kind === 'follow_accepted') {
      return data.fromUserId ? go('UserProfile', { userId: String(data.fromUserId) }) : go('Main', { screen: 'Notifications' });
    }
    if (data.postId) return go('Main', { screen: 'Home', params: { screen: 'PostDetail', params: { postId: String(data.postId) } } });
    if (data.groupId) return go('Main', { screen: 'Groups' });
    return go('Main', { screen: 'Notifications' });
  }
  if (data.conversationId) return openChat(data.conversationId);
  if (data.type === 'group') return go('Main', { screen: 'Groups' });
  if (data.type === 'digest') return go('Main', { screen: 'Notifications' });
  return null;
};

/** Runs `fn` as soon as the navigator is ready (cold start from a push tap). */
const whenReady = (fn: () => void) => {
  if (navigationRef.isReady()) { fn(); return; }
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (navigationRef.isReady()) { clearInterval(timer); fn(); }
    else if (tries > 40) clearInterval(timer); // give up after ~10s
  }, 250);
};

/** Mount once while signed in: opens the right screen when a push is tapped and keeps the device token fresh. */
export const PushNavigationHandler = () => {
  useEffect(() => {
    let handled: string | null = null;
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled === id) return;
      handled = id;
      const action = routeFor(response.notification.request.content.data as PushData);
      if (action) whenReady(action);
    };
    const responseSub = Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    // The OS can rotate the push token; the server must always hold the current one
    const tokenSub = Notifications.addPushTokenListener(() => { syncPushToken(); });
    syncPushToken();
    return () => { responseSub.remove(); tokenSub.remove(); };
  }, []);
  return null;
};
