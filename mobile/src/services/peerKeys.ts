import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Remembers the encryption key each contact had the first time we saw it (trust on first use).
 * If the server later hands us a different key for the same person, the chat shows a warning until the user
 * checks the safety number and accepts the new key. Public keys are not secret, so AsyncStorage is enough.
 */
const keyFor = (myId: string | number, peerId: string | number) => `peerkey:${myId}:${peerId}`;

export type PeerKeyState = 'new' | 'same' | 'changed';

/** First sight pins the key silently; later calls report whether it still matches. */
export const checkPeerKey = async (myId: string | number, peerId: string | number, key: string): Promise<PeerKeyState> => {
  try {
    const stored = await AsyncStorage.getItem(keyFor(myId, peerId));
    if (!stored) { await AsyncStorage.setItem(keyFor(myId, peerId), key); return 'new'; }
    return stored === key ? 'same' : 'changed';
  } catch { return 'same'; }
};

/** The user checked the safety number and accepts the contact's current key. */
export const acceptPeerKey = async (myId: string | number, peerId: string | number, key: string) => {
  try { await AsyncStorage.setItem(keyFor(myId, peerId), key); } catch { /* ignore */ }
};
