import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineMutation } from './useOfflineMutation';
import { groups } from '../services/groups';
import type { Group, GroupMember, GroupInvite, JoinRequest } from '../services/groups';

export const groupsKeys = {
  all: ['groups'] as const,
  lists: () => [...groupsKeys.all, 'list'] as const,
  list: (params?: { limit?: number; offset?: number }) => [...groupsKeys.lists(), params] as const,
  discover: (params?: { limit?: number; offset?: number; type?: string }) => [...groupsKeys.all, 'discover', params] as const,
  detail: (id: string | number) => [...groupsKeys.all, 'detail', id] as const,
  members: (id: string | number, params?: { role?: string; status?: string; limit?: number; offset?: number }) => [...groupsKeys.all, 'members', id, params] as const,
  joinRequests: (id: string | number) => [...groupsKeys.all, 'joinRequests', id] as const,
};

export function useGroups(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: groupsKeys.list(params),
    queryFn: () => groups.list(params?.limit, params?.offset).then((res) => res.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useDiscoverGroups(params?: { limit?: number; offset?: number; type?: string }) {
  return useQuery({
    queryKey: groupsKeys.discover(params),
    queryFn: () => groups.discover(params).then((res) => res.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useGroup(id: string | number) {
  return useQuery({
    queryKey: groupsKeys.detail(id),
    queryFn: () => groups.get(id).then((res) => res.data),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useOfflineMutation<Group, { name: string; description?: string; type?: string; avatar?: any }>(
    ['groups', 'create'],
    (data) => groups.create(data).then((res) => res.data),
    {
      onMutate: async (data) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.lists() });
        const previous = queryClient.getQueryData(groupsKeys.lists());
        const optimisticGroup: Group = {
          id: `temp-${Date.now()}`,
          name: data.name,
          description: data.description || null,
          type: (data.type || 'private') as 'private' | 'public' | 'secret',
          avatar: null,
          cover_image: null,
          created_by: 'me',
          member_count: 1,
          settings: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          role: 'owner',
          member_status: 'active',
        };
        queryClient.setQueryData(groupsKeys.lists(), (old: Group[] | undefined) => [optimisticGroup, ...(old || [])]);
        return previous;
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
    }
  );
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useOfflineMutation<Group, { id: string | number; name?: string; description?: string; type?: string; settings?: string; avatar?: any }>(
    ['groups', 'update'],
    ({ id, ...data }) => groups.update(id, data).then((res) => res.data),
    {
      onMutate: async ({ id, ...data }) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.detail(id) });
        await queryClient.cancelQueries({ queryKey: groupsKeys.lists() });
        const previousDetail = queryClient.getQueryData(groupsKeys.detail(id));
        const previousList = queryClient.getQueryData(groupsKeys.lists());
        queryClient.setQueryData(groupsKeys.detail(id), (old: Group | undefined) => ({ ...old, ...data }));
        queryClient.setQueryData(groupsKeys.lists(), (old: Group[] | undefined) =>
          (old || []).map((g) => (g.id === id ? { ...g, ...data } : g))
        );
        return { previousDetail, previousList };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
    }
  );
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, string | number>(
    ['groups', 'delete'],
    (id) => groups.delete(id).then(() => undefined),
    {
      onMutate: async (id: string | number) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.lists() });
        const previous = queryClient.getQueryData(groupsKeys.lists());
        queryClient.setQueryData(groupsKeys.lists(), (old: Group[] | undefined) =>
          (old || []).filter((g) => g.id !== id)
        );
        return previous;
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
    }
  );
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useOfflineMutation<{ status: string; message: string }, string | number>(
    ['groups', 'join'],
    (id) => groups.join(id).then((res) => res.data),
    {
      onMutate: async (id: string | number) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.discover() });
        const previous = queryClient.getQueryData(groupsKeys.discover());
        queryClient.setQueryData(groupsKeys.discover(), (old: Group[] | undefined) =>
          (old || []).map((g) =>
            g.id === id ? { ...g, member_status: 'active', member_count: g.member_count + 1 } : g
          )
        );
        return previous;
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.discover() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.discover() });
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
    }
  );
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, string | number>(
    ['groups', 'leave'],
    (id) => groups.leave(id).then(() => undefined),
    {
      onMutate: async (id: string | number) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.lists() });
        await queryClient.cancelQueries({ queryKey: groupsKeys.detail(id) });
        const previousList = queryClient.getQueryData(groupsKeys.lists());
        const previousDetail = queryClient.getQueryData(groupsKeys.detail(id));
        queryClient.setQueryData(groupsKeys.lists(), (old: Group[] | undefined) =>
          (old || []).map((g) =>
            g.id === id ? { ...g, member_status: 'left', member_count: Math.max(0, g.member_count - 1) } : g
          )
        );
        queryClient.setQueryData(groupsKeys.detail(id), (old: Group | undefined) =>
          old ? { ...old, member_status: 'left', member_count: Math.max(0, old.member_count - 1) } : old
        );
        return { previousList, previousDetail };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
    }
  );
}

export function useGroupMembers(groupId: string | number, params?: { role?: string; status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: groupsKeys.members(groupId, params),
    queryFn: () => groups.getMembers(groupId, params).then((res) => res.data),
    enabled: !!groupId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, { groupId: string | number; userId: string | number; role: 'admin' | 'moderator' | 'member' }>(
    ['groups', 'updateMember'],
    ({ groupId, userId, role }) => groups.updateMember(groupId, userId, role).then(() => undefined),
    {
      onMutate: async ({ groupId, userId, role }) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.members(groupId) });
        const previous = queryClient.getQueryData(groupsKeys.members(groupId));
        queryClient.setQueryData(groupsKeys.members(groupId), (old: GroupMember[] | undefined) =>
          (old || []).map((m) => (m.user_id === userId ? { ...m, role } : m))
        );
        return previous;
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'members'] });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'members'] });
      },
    }
  );
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, { groupId: string | number; userId: string | number }>(
    ['groups', 'removeMember'],
    ({ groupId, userId }) => groups.removeMember(groupId, userId).then(() => undefined),
    {
      onMutate: async ({ groupId, userId }) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.members(groupId) });
        await queryClient.cancelQueries({ queryKey: groupsKeys.detail(groupId) });
        const previousMembers = queryClient.getQueryData(groupsKeys.members(groupId));
        const previousDetail = queryClient.getQueryData(groupsKeys.detail(groupId));
        queryClient.setQueryData(groupsKeys.members(groupId), (old: GroupMember[] | undefined) =>
          (old || []).filter((m) => m.user_id !== userId)
        );
        queryClient.setQueryData(groupsKeys.detail(groupId), (old: Group | undefined) =>
          old ? { ...old, member_count: Math.max(0, old.member_count - 1) } : old
        );
        return { previousMembers, previousDetail };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'members'] });
        queryClient.invalidateQueries({ queryKey: groupsKeys.detail('' as any) });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'members'] });
        queryClient.invalidateQueries({ queryKey: groupsKeys.detail('' as any) });
      },
    }
  );
}

export function useBanMember() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, { groupId: string | number; userId: string | number }>(
    ['groups', 'banMember'],
    ({ groupId, userId }) => groups.banMember(groupId, userId).then(() => undefined),
    {
      onMutate: async ({ groupId, userId }) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.members(groupId) });
        await queryClient.cancelQueries({ queryKey: groupsKeys.detail(groupId) });
        const previousMembers = queryClient.getQueryData(groupsKeys.members(groupId));
        const previousDetail = queryClient.getQueryData(groupsKeys.detail(groupId));
        queryClient.setQueryData(groupsKeys.members(groupId), (old: GroupMember[] | undefined) =>
          (old || []).map((m) => (m.user_id === userId ? { ...m, status: 'banned' } : m))
        );
        queryClient.setQueryData(groupsKeys.detail(groupId), (old: Group | undefined) =>
          old ? { ...old, member_count: Math.max(0, old.member_count - 1) } : old
        );
        return { previousMembers, previousDetail };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'members'] });
        queryClient.invalidateQueries({ queryKey: groupsKeys.detail('' as any) });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'members'] });
        queryClient.invalidateQueries({ queryKey: groupsKeys.detail('' as any) });
      },
    }
  );
}

export function useInviteToGroup() {
  const queryClient = useQueryClient();
  return useOfflineMutation<{ invites: Array<{ user_id?: string | number; email?: string; phone?: string; token: string }> }, { groupId: string | number; data: { user_ids?: Array<string | number>; emails?: string[]; phones?: string[] } }>(
    ['groups', 'invite'],
    ({ groupId, data }) => groups.invite(groupId, data).then((res) => res.data),
    {
      onSettled: (data: any, error: any) => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
    }
  );
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, string>(
    ['groups', 'acceptInvite'],
    (token) => groups.acceptInvite(token).then(() => undefined),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
    }
  );
}

export function useRequestJoin() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, { groupId: string | number; message?: string }>(
    ['groups', 'requestJoin'],
    ({ groupId, message }) => groups.requestJoin(groupId, message).then(() => undefined),
    {
      onMutate: async ({ groupId, message }) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.discover() });
        const previous = queryClient.getQueryData(groupsKeys.discover());
        queryClient.setQueryData(groupsKeys.discover(), (old: Group[] | undefined) =>
          (old || []).map((g) =>
            g.id === groupId ? { ...g, member_status: 'pending' } : g
          )
        );
        return previous;
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.discover() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.discover() });
        queryClient.invalidateQueries({ queryKey: groupsKeys.lists() });
      },
    }
  );
}

export function useJoinRequests(groupId: string | number) {
  return useQuery({
    queryKey: groupsKeys.joinRequests(groupId),
    queryFn: () => groups.getJoinRequests(groupId).then((res) => res.data),
    enabled: !!groupId,
    staleTime: 1000 * 30,
  });
}

export function useRespondJoinRequest() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, { groupId: string | number; requestId: string | number; action: 'approve' | 'reject' }>(
    ['groups', 'respondJoinRequest'],
    ({ groupId, requestId, action }) => groups.respondJoinRequest(groupId, requestId, action).then(() => undefined),
    {
      onMutate: async ({ groupId, requestId, action }) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.joinRequests(groupId) });
        const previous = queryClient.getQueryData(groupsKeys.joinRequests(groupId));
        queryClient.setQueryData(groupsKeys.joinRequests(groupId), (old: JoinRequest[] | undefined) =>
          (old || []).map((r) =>
            r.id === requestId ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r
          )
        );
        if (action === 'approve') {
          await queryClient.cancelQueries({ queryKey: groupsKeys.detail(groupId) });
          const prevDetail = queryClient.getQueryData(groupsKeys.detail(groupId));
          queryClient.setQueryData(groupsKeys.detail(groupId), (old: Group | undefined) =>
            old ? { ...old, member_count: old.member_count + 1 } : old
          );
        }
        return previous;
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'joinRequests'] });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'joinRequests'] });
        queryClient.invalidateQueries({ queryKey: groupsKeys.detail('' as any) });
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'members'] });
      },
    }
  );
}

export function useTransferOwnership() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, { groupId: string | number; userId: string | number }>(
    ['groups', 'transferOwnership'],
    ({ groupId, userId }) => groups.transferOwnership(groupId, userId).then(() => undefined),
    {
      onMutate: async ({ groupId, userId }) => {
        await queryClient.cancelQueries({ queryKey: groupsKeys.detail(groupId) });
        await queryClient.cancelQueries({ queryKey: groupsKeys.members(groupId) });
        const previousDetail = queryClient.getQueryData(groupsKeys.detail(groupId));
        const previousMembers = queryClient.getQueryData(groupsKeys.members(groupId));
        queryClient.setQueryData(groupsKeys.detail(groupId), (old: Group | undefined) =>
          old ? { ...old, created_by: userId } : old
        );
        queryClient.setQueryData(groupsKeys.members(groupId), (old: GroupMember[] | undefined) =>
          (old || []).map((m) =>
            m.user_id === userId ? { ...m, role: 'owner' } :
            m.role === 'owner' ? { ...m, role: 'member' } : m
          )
        );
        return { previousDetail, previousMembers };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.detail('' as any) });
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'members'] });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groupsKeys.detail('' as any) });
        queryClient.invalidateQueries({ queryKey: [...groupsKeys.all, 'members'] });
      },
    }
  );
}