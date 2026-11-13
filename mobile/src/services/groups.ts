export interface Group {
  id: string | number;
  name: string;
  description?: string | null;
  avatar?: string | null;
  cover_image?: string | null;
  type: 'public' | 'private' | 'secret';
  created_by: string | number;
  member_count: number;
  settings?: Record<string, any>;
  created_at: string;
  updated_at?: string;
  role?: 'owner' | 'admin' | 'moderator' | 'member';
  member_status?: 'active' | 'pending' | 'banned' | 'left';
  is_member?: boolean;
  conversation_id?: string | number | null;
}

export interface GroupMember {
  id: string | number;
  group_id: string | number;
  user_id: string | number;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'banned' | 'left';
  joined_at: string;
  invited_by?: string | number | null;
  name: string;
  avatar?: string | null;
  username?: string | null;
}

export interface GroupInvite {
  id: string | number;
  group_id: string | number;
  inviter_id: string | number;
  invitee_id?: string | number | null;
  invitee_email?: string | null;
  invitee_phone?: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  expires_at: string;
  created_at: string;
  group_name?: string;
  group_avatar?: string | null;
  group_type?: string;
  inviter_name?: string;
}

export interface JoinRequest {
  id: string | number;
  group_id: string | number;
  user_id: string | number;
  message?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string | number | null;
  reviewed_at?: string | null;
  created_at: string;
  name: string;
  avatar?: string | null;
  username?: string | null;
}

import api from './api';

export const groups = {
  create: (data: { name: string; description?: string; type?: string; avatar?: any }) => {
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    if (data.type) formData.append('type', data.type);
    if (data.avatar) {
      formData.append('avatar', {
        uri: data.avatar.uri,
        type: data.avatar.type || 'image/jpeg',
        name: data.avatar.name || 'group.jpg',
      } as any);
    }
    return api.post<Group>('/groups', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
  },

  list: (limit?: number, offset?: number) =>
    api.get<Group[]>('/groups', { params: { limit, offset } }),

  discover: (params?: { limit?: number; offset?: number; type?: string }) =>
    api.get<Group[]>('/groups/discover', { params }),

  get: (id: string | number) =>
    api.get<Group>(`/groups/${id}`),

  update: (id: string | number, data: { name?: string; description?: string; type?: string; settings?: string; avatar?: any }) => {
    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.description !== undefined) formData.append('description', data.description);
    if (data.type) formData.append('type', data.type);
    if (data.settings) formData.append('settings', data.settings);
    if (data.avatar) {
      formData.append('avatar', {
        uri: data.avatar.uri,
        type: data.avatar.type || 'image/jpeg',
        name: data.avatar.name || 'group.jpg',
      } as any);
    }
    return api.put<Group>(`/groups/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
  },

  delete: (id: string | number) =>
    api.delete(`/groups/${id}`),

  join: (id: string | number) =>
    api.post<{ status: string; message: string }>(`/groups/${id}/join`),

  leave: (id: string | number) =>
    api.post(`/groups/${id}/leave`),

  getMembers: (id: string | number, params?: { role?: string; status?: string; limit?: number; offset?: number }) =>
    api.get<GroupMember[]>(`/groups/${id}/members`, { params }),

  updateMember: (id: string | number, userId: string | number, role: 'admin' | 'moderator' | 'member') =>
    api.put(`/groups/${id}/members/${userId}`, { role }),

  removeMember: (id: string | number, userId: string | number) =>
    api.delete(`/groups/${id}/members/${userId}`),

  banMember: (id: string | number, userId: string | number) =>
    api.post(`/groups/${id}/ban/${userId}`),

  invite: (id: string | number, data: { user_ids?: Array<string | number>; emails?: string[]; phones?: string[] }) =>
    api.post<{ invites: Array<{ user_id?: string | number; email?: string; phone?: string; token: string }> }>(`/groups/${id}/invite`, data),

  myInvites: () => api.get<GroupInvite[]>('/groups/invites'),

  declineInvite: (token: string) =>
    api.post(`/groups/invites/${token}/decline`),

  getInvite: (token: string) =>
    api.get<GroupInvite>(`/groups/invites/${token}`),

  acceptInvite: (token: string) =>
    api.post(`/groups/invites/${token}/accept`),

  requestJoin: (id: string | number, message?: string) =>
    api.post(`/groups/${id}/join-request`, { message }),

  getJoinRequests: (id: string | number) =>
    api.get<JoinRequest[]>(`/groups/${id}/join-requests`),

  respondJoinRequest: (id: string | number, requestId: string | number, action: 'approve' | 'reject') =>
    api.post(`/groups/${id}/join-requests/${requestId}`, { action }),

  transferOwnership: (id: string | number, userId: string | number) =>
    api.post(`/groups/${id}/transfer-ownership`, { user_id: userId }),
};

export default groups;