import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { offlineQueue, QueuedMutation, registerMutationHandler, isNetworkError } from '../utils/offlineQueue';
import NetInfo from '@react-native-community/netinfo';

export function useOfflineMutation<TData, TVariables>(
  mutationKey: string[],
  mutateFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onMutate?: (variables: TVariables) => any;
    onSuccess?: (data: TData) => void;
    onError?: (error: any, variables: TVariables, context: any) => void;
    onSettled?: (data: TData | undefined, error: any) => void;
  }
) {
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe(setQueue);
    NetInfo.fetch().then((state) => setIsOnline(state.isConnected ?? true));
    const netUnsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
    return () => {
      unsubscribe();
      netUnsubscribe();
    };
  }, []);

  // Lets the persisted queue replay this mutation (also after an app restart, once this hook is mounted)
  registerMutationHandler(mutationKey, mutateFn as any);

  const mutation = useMutation<TData, any, TVariables, any>({
    mutationFn: mutateFn,
    // 'always': run even while offline so the request fails fast and gets queued below,
    // instead of React Query silently pausing it
    networkMode: 'always',
    retry: false,
    onMutate: (variables: TVariables) => options?.onMutate?.(variables),
    onSuccess: (data: TData) => {
      options?.onSuccess?.(data);
    },
    onError: (error: any, variables: TVariables, context: any) => {
      // Only connectivity failures are worth replaying; a 4xx would fail again
      if (isNetworkError(error)) {
        offlineQueue.enqueue({ mutationKey, variables });
      }
      options?.onError?.(error, variables, context);
    },
    onSettled: (data: TData | undefined, error: any) => {
      options?.onSettled?.(data, error);
    },
  });

  const mutateOffline = (variables: TVariables, callOptions?: { onSuccess?: (data: TData) => void; onError?: (error: any) => void }) => {
    mutation.mutate(variables, callOptions);
  };

  return {
    ...mutation,
    mutate: mutateOffline,
    mutateAsync: mutation.mutateAsync,
    isOffline: !isOnline,
    offlineQueue: queue,
  };
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe(setQueue);
    NetInfo.fetch().then((state) => setIsOnline(state.isConnected ?? true));
    const netUnsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
    return () => {
      unsubscribe();
      netUnsubscribe();
    };
  }, []);

  const retry = async (id: string) => {
    const mutation = queue.find((m) => m.id === id);
    if (mutation) {
      try {
        await offlineQueue['executeMutation'](mutation);
        await offlineQueue.remove(id);
      } catch (error) {
        await offlineQueue.incrementRetry(id);
      }
    }
  };

  const remove = async (id: string) => {
    await offlineQueue.remove(id);
  };

  const clear = async () => {
    await offlineQueue.clear();
  };

  return {
    queue,
    isOnline,
    retry,
    remove,
    clear,
    pendingCount: queue.length,
  };
}