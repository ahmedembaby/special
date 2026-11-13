import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { db } from '../db/offlineDb';
import api from './api';

const SYNC_TASK = 'echat-sync-task';

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const pending = await db.getAllAsync<
      Array<{
        id: string;
        conversation_id: string;
        sender_id: string;
        content: string;
        type: string;
      }>
    >('SELECT * FROM offline_messages WHERE status = ?', ['pending']);

    for (const msg of pending) {
      await api.post('/messages', {
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        content: msg.content,
        type: msg.type,
      });
      await db.runAsync('UPDATE offline_messages SET status = ? WHERE id = ?', [
        'sent',
        msg.id,
      ]);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerBackgroundSync = async () => {
  await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
    minimumInterval: 15 * 60, // 15 minutes
    stopOnTerminate: false,
    startOnBoot: true,
  });
};
