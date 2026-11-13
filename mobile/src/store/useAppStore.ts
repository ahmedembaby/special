import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  // UI / Theme
  isDarkMode: boolean;
  setDarkMode: (val: boolean) => void;

  // Active conversation (for navigation focus)
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;

  // Socket connection status
  isSocketConnected: boolean;
  setSocketConnected: (val: boolean) => void;

  // Offline sync badge
  pendingMessagesCount: number;
  setPendingMessagesCount: (n: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isDarkMode: false,
      setDarkMode: (val) => set({ isDarkMode: val }),
      activeConversationId: null,
      setActiveConversation: (id) => set({ activeConversationId: id }),
      isSocketConnected: false,
      setSocketConnected: (val) => set({ isSocketConnected: val }),
      pendingMessagesCount: 0,
      setPendingMessagesCount: (n) => set({ pendingMessagesCount: n }),
    }),
    {
      name: 'echat-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
