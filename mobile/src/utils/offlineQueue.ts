import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Legacy single global key (pre owner-scoping). Its items have no owner, so they are discarded, never replayed.
const LEGACY_QUEUE_KEY = '@offline_mutation_queue';
const queueKeyFor = (ownerId: string) => `@offline_mutation_queue:v2:${encodeURIComponent(ownerId)}`;
const MAX_RETRIES = 3;

export interface QueuedMutation {
  id: string;
  ownerId: string;
  mutationKey: string[];
  variables: any;
  timestamp: number;
  retries: number;
}

// Mutation functions registered by useOfflineMutation, keyed by mutationKey.join('.').
// (Functions cannot be persisted, only the key + variables are stored in the queue.)
const handlers = new Map<string, (variables: any) => Promise<any>>();
let onHandlerAdded: (() => void) | null = null;
export const registerMutationHandler = (key: string[], fn: (variables: any) => Promise<any>) => {
  const k = key.join('.');
  const isNew = !handlers.has(k);
  handlers.set(k, fn);
  // A screen that owns queued work just mounted: replay what was waiting for it
  if (isNew) onHandlerAdded?.();
};
export const clearMutationHandlers = () => handlers.clear();
export const isNetworkError = (err: any) => !!err && !err.response && (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || /network|timeout/i.test(err.message || ''));

class OfflineQueue {
  private queue: QueuedMutation[] = [];
  private isProcessing = false;
  private listeners: Set<(queue: QueuedMutation[]) => void> = new Set();
  private netInfoUnsubscribe: (() => void) | null = null;
  // The account whose queue is active. Nothing is stored or replayed without one.
  private ownerId: string | null = null;
  // Bumped on every owner change so an in-flight replay loop stops immediately.
  private epoch = 0;

  async init() {
    if (!this.netInfoUnsubscribe) this.setupNetworkListener();
    onHandlerAdded = () => { if (this.ownerId && !this.isProcessing) this.processQueue(); };
  }

  /** Activate the queue for a signed-in account (or pass null when signed out). */
  async setOwner(ownerId: string | null) {
    if (ownerId === this.ownerId) return;
    this.epoch += 1;
    this.ownerId = ownerId;
    this.queue = [];
    this.notifyListeners();
    if (!ownerId) return;
    await this.loadQueue(ownerId);
    // Drop the pre-scoping global queue: its items cannot be attributed to an account
    AsyncStorage.removeItem(LEGACY_QUEUE_KEY).catch(() => {});
    if (this.ownerId === ownerId && !this.isProcessing) this.processQueue();
  }

  /** Sign-out: stop replay, forget handlers and in-memory items; optionally wipe the account's stored queue. */
  async deactivate(options?: { clearStored?: boolean }) {
    const previous = this.ownerId;
    this.epoch += 1;
    this.ownerId = null;
    this.queue = [];
    clearMutationHandlers();
    this.notifyListeners();
    if (options?.clearStored) {
      AsyncStorage.removeItem(LEGACY_QUEUE_KEY).catch(() => {});
      if (previous) await AsyncStorage.removeItem(queueKeyFor(previous)).catch(() => {});
    }
  }

  private async readStored(ownerId: string): Promise<QueuedMutation[]> {
    try {
      const stored = await AsyncStorage.getItem(queueKeyFor(ownerId));
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((m: QueuedMutation) => m && m.ownerId === ownerId) : [];
    } catch (e) {
      console.error('Failed to load offline queue:', e);
      return [];
    }
  }

  private async loadQueue(ownerId: string) {
    const items = await this.readStored(ownerId);
    if (this.ownerId !== ownerId) return; // owner changed while loading
    this.queue = items;
    this.notifyListeners();
  }

  private async writeStored(ownerId: string, items: QueuedMutation[]) {
    try {
      await AsyncStorage.setItem(queueKeyFor(ownerId), JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }

  private async saveQueue() {
    if (this.ownerId) await this.writeStored(this.ownerId, this.queue);
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

  async enqueue(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries' | 'ownerId'>) {
    // Never queue work that is not tied to a signed-in account
    if (!this.ownerId) return null;
    const queued: QueuedMutation = {
      ...mutation,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ownerId: this.ownerId,
      timestamp: Date.now(),
      retries: 0,
    };
    this.queue.push(queued);
    await this.saveQueue();
    this.notifyListeners();
    return queued.id;
  }

  /** Remove an item belonging to the given owner, even if that owner is no longer active. */
  private async removeFor(ownerId: string, id: string) {
    if (ownerId === this.ownerId) {
      this.queue = this.queue.filter((m) => m.id !== id);
      await this.saveQueue();
      this.notifyListeners();
    } else {
      const items = await this.readStored(ownerId);
      await this.writeStored(ownerId, items.filter((m) => m.id !== id));
    }
  }

  async remove(id: string) {
    if (this.ownerId) await this.removeFor(this.ownerId, id);
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
    if (this.isProcessing || !this.ownerId || this.queue.length === 0) return;

    const epoch = this.epoch;
    const ownerId = this.ownerId;
    this.isProcessing = true;
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || this.epoch !== epoch) return;

      for (const mutation of [...this.queue]) {
        const net = await NetInfo.fetch();
        if (!net.isConnected) break;
        // Account changed or signed out: stop before sending anything more
        if (this.epoch !== epoch || mutation.ownerId !== ownerId) break;

        try {
          await this.executeMutation(mutation);
          await this.removeFor(ownerId, mutation.id);
        } catch (error: any) {
          // The screen that owns this mutation is not mounted yet: keep it, it is retried when its handler registers
          if (error?.code === 'NO_HANDLER') continue;
          if (this.epoch !== epoch) break;
          const status = error?.response?.status;
          const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
          await this.incrementRetry(mutation.id);
          if (permanent || mutation.retries >= MAX_RETRIES) {
            console.warn('Dropping queued mutation:', mutation.mutationKey.join('.'), error?.message);
            await this.removeFor(ownerId, mutation.id);
          }
        }
      }
    } catch (e) {
      console.warn('Offline queue replay failed:', e);
    } finally {
      this.isProcessing = false;
    }
  }

  async executeMutation(mutation: QueuedMutation) {
    // Hard owner check right before sending: a mutation only ever runs for the account that queued it
    if (!this.ownerId || mutation.ownerId !== this.ownerId) {
      throw Object.assign(new Error('Queued mutation belongs to a different account'), { code: 'OWNER_MISMATCH' });
    }
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
    this.netInfoUnsubscribe = null;
    this.listeners.clear();
  }
}

export const offlineQueue = new OfflineQueue();
