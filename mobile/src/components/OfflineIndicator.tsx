import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useOfflineQueue } from '../hooks/useOfflineMutation';
import { Colors } from '../theme';

export function OfflineIndicator() {
  const { queue, isOnline, pendingCount } = useOfflineQueue();
  const [opacity, setOpacity] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (!isOnline || pendingCount > 0) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [isOnline, pendingCount, opacity]);

  if (isOnline && pendingCount === 0) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity },
        !isOnline ? styles.offline : styles.syncing,
      ]}
      pointerEvents="none"
    >
      <View style={styles.content}>
        {!isOnline && (
          <>
            <Text style={styles.icon}>📴</Text>
            <Text style={styles.text}>You're offline</Text>
          </>
        )}
        {pendingCount > 0 && isOnline && (
          <>
            <Text style={styles.icon}>🔄</Text>
            <Text style={styles.text}>Syncing {pendingCount} change{pendingCount > 1 ? 's' : ''}...</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  offline: {
    backgroundColor: Colors.warning || '#f59e0b',
  },
  syncing: {
    backgroundColor: Colors.primary || '#3b82f6',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 18,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  debugContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  debugTitle: {
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
    fontSize: 14,
  },
  debugItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  debugMutation: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  debugTime: {
    color: '#888',
    fontSize: 10,
    marginBottom: 8,
  },
  debugActions: {
    flexDirection: 'row',
    gap: 8,
  },
  debugButton: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 12,
  },
  debugButtonDanger: {
    color: '#ef4444',
  },
  debugClear: {
    color: '#ef4444',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
});

function OfflineQueueDebug() {
  const { queue, isOnline, retry, remove, clear } = useOfflineQueue();

  if (queue.length === 0) return null;

  return (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>
        📦 Offline Queue ({queue.length}) - {isOnline ? 'Online' : 'Offline'}
      </Text>
      {queue.map((m) => (
        <View key={m.id} style={styles.debugItem}>
          <Text style={styles.debugMutation}>{m.mutationKey.join('.')}</Text>
          <Text style={styles.debugTime}>
            {new Date(m.timestamp).toLocaleTimeString()} • Retries: {m.retries}
          </Text>
          <View style={styles.debugActions}>
            <Text onPress={() => retry(m.id)} style={styles.debugButton}>
              Retry
            </Text>
            <Text onPress={() => remove(m.id)} style={[styles.debugButton, styles.debugButtonDanger]}>
              Remove
            </Text>
          </View>
        </View>
      ))}
      {queue.length > 0 && (
        <Text onPress={clear} style={styles.debugClear}>
          Clear All
        </Text>
      )}
    </View>
  );
}

export { OfflineQueueDebug };