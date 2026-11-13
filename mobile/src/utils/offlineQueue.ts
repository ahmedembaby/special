import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = '@offline_mutation_queue';
const MAX_RETRIES = 3;

export interface QueuedMutation {
  id: string;
  mutationKey: string[];
  variables: any;
  timestamp: number;
  retries: number;
}

// Mutation functions registered by useOfflineMutation, keyed by mutationKey.join('.').
// (Functions cannot be persisted, only the key + variables are stored in the queue.)
const handlers = new Map<string, (variables: any) => Promise<any>>();
export const registerMutationHandler = (key: string[], fn: (variables: any) => Promise<any>) => {
  handlers.set(key.join('.'), fn);
};
export const isNetworkError = (err: any) => !!err && !err.response && (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || /network|timeout/i.test(err.message || ''));

class OfflineQueue {
  private queue: QueuedMutation[] = [];
  private isProcessing = false;
  private listeners: Set<(queue: QueuedMutation[]) => void> = new Set();
  private netInfoUnsubscribe: (() => void) | null = null;

  async init() {
    await this.loadQueue();
    this.setupNetworkListener();
  }

  private async loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        this.notifyListeners();
      }
    } catch (e) {
      console.error('Failed to load offline queue:', e);
    }
  }

  private async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }

  private setupNetworkListener() {
    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb([...this.queue]));
  }

  subscribe(listener: (queue: QueuedMutation[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getQueue(): QueuedMutation[] {
    return [...this.queue];
  }

  async enqueue(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'>) {
    const queued: QueuedMutation = {
      ...mutation,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };
    this.queue.push(queued);
    await this.saveQueue();
    this.notifyListeners();
    return queued.id;
  }

  async remove(id: string) {
    this.queue = this.queue.filter((m) => m.id !== id);
    await this.saveQueue();
    this.notifyListeners();
  }

  async incrementRetry(id: string) {
    const mutation = this.queue.find((m) => m.id === id);
    if (mutation) {
      mutation.retries += 1;
      await this.saveQueue();
      this.notifyListeners();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) return;

    this.isProcessing = true;

    for (const mutation of [...this.queue]) {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) break;

      try {
        await this.executeMutation(mutation);
        await this.remove(mutation.id);
      } catch (error: any) {
        // The screen that owns this mutation is not mounted yet: keep it for later
        if (error?.code === 'NO_HANDLER') continue;
        const status = error?.response?.status;
        const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
        await this.incrementRetry(mutation.id);
        if (permanent || mutation.retries >= MAX_RETRIES) {
          console.warn('Dropping queued mutation:', mutation.mutationKey.join('.'), error?.message);
          await this.remove(mutation.id);
        }
      }
    }

    this.isProcessing = false;
  }

  async executeMutation(mutation: QueuedMutation) {
    const fn = handlers.get(mutation.mutationKey.join('.'));
    if (!fn) throw Object.assign(new Error(`No handler for ${mutation.mutationKey.join('.')}`), { code: 'NO_HANDLER' });
    return fn(mutation.variables);
  }

  async clear() {
    this.queue = [];
    await this.saveQueue();
    this.notifyListeners();
  }

  destroy() {
    this.netInfoUnsubscribe?.();
    this.listeners.clear();
  }
}

export const offlineQueue = new OfflineQueue();