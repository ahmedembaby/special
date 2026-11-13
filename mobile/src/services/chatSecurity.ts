import * as SecureStore from 'expo-secure-store';

const keyFor = (conversationId: string | number) => 'special_chat_lock_' + String(conversationId);

export async function isConversationLocked(conversationId: string | number): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(keyFor(conversationId))) === '1'; }
  catch { return true; }
}

export async function setConversationLocked(conversationId: string | number, enabled: boolean): Promise<void> {
  if (enabled) await SecureStore.setItemAsync(keyFor(conversationId), '1');
  else await SecureStore.deleteItemAsync(keyFor(conversationId));
}
