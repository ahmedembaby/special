import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StatusBar, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as api from '../services/api';
import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { Colors, Typography, Spacing, BorderRadius } from '../theme/index';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from '../components/Icon';

export default function GroupChatScreen() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const [users, setUsers] = useState<api.User[]>([]);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.users
      .list()
      .then((res) => setUsers(res.data || []))
      .catch(() => Alert.alert('Error', 'Could not load users'))
      .finally(() => setLoading(false));
  }, []);

  const toggleUser = (id: string | number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const canCreate = selected.size > 0 && !!groupName.trim() && !creating;

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    setCreating(true);
    try {
      const res = await api.conversations.create({
        name: groupName.trim(),
        type: 'group',
        participantIds: Array.from(selected),
      });
      navigation.replace('Chat', { conversationId: res.data.id });
    } catch {
      Alert.alert('Error', 'Failed to create group');
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Header title="New Group" onBack={() => navigation.goBack()} />
      <View style={[styles.inputWrap, { backgroundColor: c.background }]}>
        <TextInput
          placeholder="Group name"
          placeholderTextColor={c.textSecondary}
          value={groupName}
          onChangeText={setGroupName}
          style={[
            styles.input,
            { backgroundColor: c.card, borderColor: c.border, color: c.text },
          ]}
        />
      </View>
      <View style={[styles.listWrap, { backgroundColor: c.background }]}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>
          Select participants ({selected.size})
        </Text>
        {loading ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item }) => {
              const on = selected.has(item.id);
              return (
                <TouchableOpacity
                  style={[
                    styles.userItem,
                    { backgroundColor: on ? c.primaryLight : c.card, borderColor: on ? c.primary : 'transparent' },
                  ]}
                  onPress={() => toggleUser(item.id)}
                >
                  <Avatar source={item.avatar} name={item.name} size={44} status={item.status} userId={item.id} />
                  <Text style={[styles.userName, { color: on ? c.primary : c.text, fontWeight: on ? '700' : '400' }]}>
                    {item.name}
                  </Text>
                  {on ? <Icon name="check" size={20} color={c.primary} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
      <TouchableOpacity
        style={[styles.createBtn, { backgroundColor: c.primary, opacity: canCreate ? 1 : 0.5 }]}
        onPress={createGroup}
        disabled={!canCreate}
      >
        <Text style={[styles.createBtnText, { color: '#FFFFFF' }]}>
          {creating ? 'Creating...' : 'Create Group'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inputWrap: { paddingHorizontal: 18, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 17,
    paddingVertical: 15,
    fontSize: 16,
  },
  listWrap: { flex: 1, paddingHorizontal: 18, marginTop: 20 },
  sectionTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    marginBottom: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  userName: { flex: 1, fontSize: 16, marginLeft: 12 },
  check: { fontWeight: '800', fontSize: 18, paddingRight: 8 },
  createBtn: {
    borderRadius: 17,
    paddingVertical: 16,
    alignItems: 'center',
    margin: 16,
  },
  createBtnText: { ...Typography.button, color: '#FFFFFF' },
});
