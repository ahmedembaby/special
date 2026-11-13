import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useGroups, useCreateGroup, useJoinGroup, useLeaveGroup, useDiscoverGroups } from '../hooks/useGroupsQueries';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { resolveUrl } from '../config';
import { useAppColors } from '../theme/useAppColors';
import type { ThemeColors } from '../theme/colors';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { TopTabs } from '../components/Tabs';
import { SearchBar } from '../components/SearchBar';

export function GroupsScreen() {
  const navigation = useNavigation() as any;
  const { c } = useAppColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState<0 | 1>(0); // 0 = my groups, 1 = discover
  const [search, setSearch] = useState('');
  const mine = useGroups();
  const discover = useDiscoverGroups();
  const active = tab === 0 ? mine : discover;
  const all = (active.data as any[] | undefined) || [];
  const q = search.trim().toLowerCase();
  const groups = q ? all.filter((g) => `${g.name} ${g.description || ''}`.toLowerCase().includes(q)) : all;
  const refetch = () => { mine.refetch(); discover.refetch(); };
  const createGroup = useCreateGroup();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupType, setNewGroupType] = useState<'public' | 'private'>('private');

  const handleCreate = () => {
    if (!newGroupName.trim()) return;
    createGroup.mutate(
      { name: newGroupName, description: newGroupDesc, type: newGroupType },
      {
        onSuccess: () => {
          setShowCreateModal(false);
          setNewGroupName('');
          setNewGroupDesc('');
          refetch();
        },
      }
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Groups" rightIcon="mail" onRightPress={() => navigation.navigate('GroupInvites')}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search groups" />
        </View>
        <TopTabs tabs={['My groups', 'Discover']} active={tab} onChange={(i) => setTab(i as 0 | 1)} />
      </ScreenHeader>

      {active.isLoading ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><Icon name="users" size={38} color={c.primary} /></View>
          <Text style={styles.emptyTitle}>{q ? 'No matches' : tab === 0 ? 'No groups yet' : 'Nothing to discover'}</Text>
          <Text style={styles.emptyText}>
            {q ? 'Try a different name.' : tab === 0 ? 'Create a group and invite your friends.' : 'There are no public groups right now.'}
          </Text>
          {tab === 0 && !q ? (
            <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
              <Text style={styles.createButtonText}>Create your first group</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <GroupItem group={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={active.isRefetching}
          onRefresh={() => active.refetch()}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreateModal(true)} activeOpacity={0.85}>
        <Icon name="plus" size={26} color="#FFFFFF" strokeWidth={2.4} />
      </TouchableOpacity>

      <CreateGroupModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
        name={newGroupName}
        onNameChange={setNewGroupName}
        description={newGroupDesc}
        onDescriptionChange={setNewGroupDesc}
        type={newGroupType}
        onTypeChange={setNewGroupType}
        loading={createGroup.isPending}
      />
    </View>
  );
}

function GroupItem({ group }: { group: any }) {
  const { user } = useAuth();
  const { c } = useAppColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation() as any;
  const isMember = group.member_status === 'active' || group.member_status === 'pending';
  const isOwner = group.role === 'owner' || String(group.created_by) === String(user?.id);
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();

  const handleLeave = () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveGroup.mutate(group.id) },
    ]);
  };

  const open = () => {
    if (group.member_status === 'active' && group.conversation_id) {
      navigation.navigate('Messages', { screen: 'Chat', params: { conversationId: group.conversation_id } });
    }
  };

  return (
    <TouchableOpacity style={styles.groupCard} onPress={open} activeOpacity={0.85}>
      <View style={styles.groupHeader}>
        {group.avatar ? (
          <Image source={{ uri: resolveUrl(group.avatar) || undefined }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Icon name="users" size={26} color="#fff" />
          </View>
        )}
        <View style={styles.groupInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
            {isOwner ? <Text style={styles.ownerBadge}>Owner</Text> : null}
          </View>
          {group.description ? <Text style={styles.groupDesc} numberOfLines={2}>{group.description}</Text> : null}
          <View style={styles.groupMeta}>
            <Icon name="users" size={14} color={c.textMuted} strokeWidth={1.6} />
            <Text style={styles.metaItem}>{group.member_count} members</Text>
            <Text style={[styles.typeChip, group.type === 'public' ? styles.chipPublic : styles.chipPrivate]}>
              {group.type === 'public' ? 'Public' : 'Private'}
            </Text>
          </View>
        </View>
      </View>
      {isMember ? (
        group.member_status === 'pending' ? (
          <Text style={styles.pendingText}>Request pending…</Text>
        ) : (
          <TouchableOpacity style={[styles.actionButton, styles.leaveButton]} onPress={handleLeave}>
            <Text style={[styles.actionButtonText, { color: c.danger }]}>Leave</Text>
          </TouchableOpacity>
        )
      ) : (
        <TouchableOpacity style={[styles.actionButton, styles.joinButton]} onPress={() => joinGroup.mutate(group.id)} disabled={joinGroup.isPending}>
          <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>{joinGroup.isPending ? 'Joining…' : 'Join'}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function CreateGroupModal({ visible, onClose, onCreate, name, onNameChange, description, onDescriptionChange, type, onTypeChange, loading }: any) {
  const { c } = useAppColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!visible) return null;

  const TypeOption = ({ value, title, desc }: { value: 'public' | 'private'; title: string; desc: string }) => (
    <TouchableOpacity style={[styles.typeOption, type === value && styles.typeOptionSelected]} onPress={() => onTypeChange(value)} activeOpacity={0.85}>
      <Text style={[styles.typeOptionText, type === value && { color: c.primary }]}>{title}</Text>
      <Text style={styles.typeOptionDesc}>{desc}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalContainer}>
          <View style={styles.grab} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New group</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="x" size={22} color={c.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <TextInput style={styles.input} placeholder="Group name" placeholderTextColor={c.placeholder} value={name} onChangeText={onNameChange} maxLength={100} autoFocus />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description (optional)" placeholderTextColor={c.placeholder} value={description} onChangeText={onDescriptionChange} maxLength={500} multiline />
            <Text style={styles.typeLabel}>Group type</Text>
            <View style={styles.typeOptions}>
              <TypeOption value="public" title="Public" desc="Anyone can join" />
              <TypeOption value="private" title="Private" desc="Requires approval" />
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
              <Text style={{ color: c.textSecondary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalCreateButton, (loading || !name.trim()) && { opacity: 0.5 }]} onPress={onCreate} disabled={loading || !name.trim()}>
              <Text style={styles.createButtonText}>{loading ? 'Creating…' : 'Create group'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  fab: { position: 'absolute', right: 18, bottom: 20, width: 58, height: 58, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: c.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 70, paddingHorizontal: 40 },
  emptyIcon: { width: 84, height: 84, borderRadius: 28, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 18, fontSize: 20, fontWeight: '700', color: c.text },
  emptyText: { marginTop: 6, fontSize: 15, color: c.textSecondary, textAlign: 'center' },
  createButton: { marginTop: 22, paddingHorizontal: 24, height: 48, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  listContent: { paddingTop: 4, paddingBottom: 110 },
  groupCard: { backgroundColor: c.card, borderRadius: 20, marginHorizontal: 16, marginTop: 10, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, shadowOpacity: 0, elevation: 0 },
  groupHeader: { flexDirection: 'row', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 19 },
  avatarPlaceholder: { backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center' },
  groupInfo: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupName: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: c.text },
  groupDesc: { fontSize: 14, color: c.textSecondary, marginTop: 3 },
  groupMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  metaItem: { fontSize: 13, color: c.textMuted },
  typeChip: { marginLeft: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  chipPublic: { backgroundColor: c.primaryLight, color: c.success },
  chipPrivate: { backgroundColor: c.primaryLight, color: c.warning },
  ownerBadge: { backgroundColor: c.primaryLight, color: c.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  actionButton: { marginTop: 12, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  joinButton: { backgroundColor: c.primary },
  leaveButton: { backgroundColor: c.background },
  actionButtonText: { fontWeight: '700', fontSize: 14 },
  pendingText: { textAlign: 'center', color: c.textSecondary, fontSize: 14, marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: c.overlay },
  modalContainer: { backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 10, backgroundColor: c.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: c.text },
  modalContent: { paddingHorizontal: 20, maxHeight: 360 },
  input: { backgroundColor: c.inputBg, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: c.text, marginBottom: 12 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  typeLabel: { fontSize: 13, fontWeight: '700', color: c.textSecondary, marginBottom: 8, marginTop: 4 },
  typeOptions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  typeOption: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', backgroundColor: c.inputBg },
  typeOptionSelected: { borderColor: c.primary, backgroundColor: c.primaryLight },
  typeOptionText: { fontSize: 16, fontWeight: '700', color: c.text },
  typeOptionDesc: { fontSize: 12, color: c.textSecondary, marginTop: 4 },
  modalFooter: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  cancelButton: { flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.inputBg },
  modalCreateButton: { flex: 2, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
});

export default GroupsScreen;
