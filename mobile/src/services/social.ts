/**
 * Social layer (feed, likes, comments, notifications, follows).
 * The server (`/api/social/*`) is the single source of truth: there is no local/demo data.
 *
 *   GET  /social/posts                 GET  /social/posts/user/:username    GET /social/posts/:id
 *   POST /social/posts (multipart)     DELETE /social/posts/:id
 *   POST /social/posts/:id/like        POST /social/comments/post/:id
 *   GET  /social/notifications         PUT  /social/notifications/read-all  DELETE /social/notifications/:id
 *   GET  /social/following             POST /social/users/:id/follow        GET /social/suggested-users
 *   GET  /search/posts?q=
 */
import api from './api';

export interface SocialUser {
  id: string;
  name: string;
  username: string;
  avatar?: string | null;
  verified?: boolean;
  bio?: string;
  is_following?: boolean;
}

export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

export interface ReactionCount { emoji: string; count: number }

export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  user: SocialUser;
  /** top-level comment this one belongs to (null for top-level comments) */
  parentId?: string | null;
  reactions?: ReactionCount[];
  my_reaction?: string | null;
  likes_count?: number;
  /** who this comment answers */
  replyTo?: { id: string; name: string; username: string } | null;
}

export interface Post {
  id: string;
  content: string;
  image?: string | null;
  reactions?: ReactionCount[];
  my_reaction?: string | null;
  /** all pictures of the post (up to 4); `image` is the first one */
  images?: string[];
  createdAt: string;
  user: SocialUser;
  likes: string[];
  comments: PostComment[];
  reposts: number;
  bookmarked?: boolean;
  repost_of?: { id: string; content?: string; image?: string; user?: SocialUser; deleted?: boolean };
  poll?: { options: Array<{ id: string; text: string; votes: number }>; total: number; my_vote: string | null };
  likes_count?: number;
  comments_count?: number;
}

export interface AppNotification {
  id: string;
  read?: boolean;
  type: 'like' | 'comment' | 'follow' | 'group_invite' | 'group_request' | 'group_approved' | 'mention' | 'follow_request' | 'follow_accepted';
  from: SocialUser;
  createdAt: string;
  post?: { id: string; content: string; image?: string | null };
  comment?: { id: string; content: string };
  group?: { id: string; name: string; avatar?: string | null };
}

export interface Me {
  id: string;
  name: string;
  username: string;
  avatar?: string | null;
}


export const makeUsername = (name?: string, id?: string | number) => {
  const base = (name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  return base || `user${id ?? ''}`;
};

export const toMe = (
  u: { id?: string | number; name?: string; username?: string | null; avatar?: string | null } | null | undefined
): Me => ({
  id: String(u?.id ?? 'me'),
  name: u?.name || 'Me',
  username: u?.username || makeUsername(u?.name, u?.id),
  avatar: u?.avatar,
});

export const TRENDING = [
  { category: 'Technology · Trending', topic: '#ReactNative', posts: '125K' },
  { category: 'Trending in Egypt', topic: '#Cairo', posts: '89K' },
  { category: 'Technology · Trending', topic: '#TypeScript', posts: '54K' },
  { category: 'Business · Trending', topic: '#Startups', posts: '38K' },
  { category: 'Technology · Trending', topic: '#AI', posts: '567K' },
  { category: 'Sports · Trending', topic: '#Football', posts: '212K' },
];


// ---------- posts ----------
export const listPosts = async (username?: string): Promise<Post[]> => {
  // main feed: ranked by engagement and recency (newest-first stays the server default)
  const url = username ? `/social/posts/user/${encodeURIComponent(username)}` : '/social/posts?sort=ranked';
  const res = await api.get<Post[]>(url);
  return res.data || [];
};

export const getPost = async (id: string): Promise<Post> => (await api.get<Post>(`/social/posts/${id}`)).data;

export const MAX_POST_IMAGES = 4;

export interface PostExtras { pollOptions?: string[]; repostOf?: string }
export const createPost = async (_me: Me, content: string, images?: string | string[] | null, extras?: PostExtras): Promise<Post> => {
  const fd = new FormData();
  fd.append('content', content);
  if (extras?.pollOptions && extras.pollOptions.length >= 2) fd.append('poll_options', JSON.stringify(extras.pollOptions));
  if (extras?.repostOf) fd.append('repost_of', extras.repostOf);
  const list = (Array.isArray(images) ? images : images ? [images] : []).slice(0, MAX_POST_IMAGES);
  list.forEach((uri, i) => fd.append('images', { uri, name: `post-${i}.jpg`, type: 'image/jpeg' } as any));
  const res = await api.post<Post>('/social/posts', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (d) => d,
    timeout: 60000,
  });
  return res.data;
};

export const toggleBookmark = async (postId: string): Promise<boolean> => (await api.post<{ bookmarked: boolean }>(`/social/posts/${postId}/bookmark`)).data.bookmarked;
export const getBookmarks = async (): Promise<Post[]> => (await api.get<Post[]>('/social/bookmarks')).data || [];
export const votePoll = async (postId: string, optionId: string): Promise<Post> => (await api.post<Post>(`/social/posts/${postId}/vote`, { option_id: optionId })).data;

export const editPost = async (id: string, content: string): Promise<Post> => (await api.put<Post>(`/social/posts/${id}`, { content })).data;

export const deletePost = async (id: string) => {
  await api.delete(`/social/posts/${id}`);
};

export const toggleLike = async (_me: Me, postId: string): Promise<{ liked: boolean; likes_count: number }> =>
  (await api.post(`/social/posts/${postId}/like`)).data;

export interface ReactionResult { reaction: string | null; liked: boolean; likes_count: number; reactions: ReactionCount[] }

export const reactToPost = async (postId: string, emoji: string): Promise<ReactionResult> =>
  (await api.post<ReactionResult>(`/social/posts/${postId}/react`, { emoji })).data;

export const reactToComment = async (commentId: string, emoji: string): Promise<ReactionResult> =>
  (await api.post<ReactionResult>(`/social/comments/${commentId}/react`, { emoji })).data;

export const addComment = async (_me: Me, postId: string, content: string, parentId?: string | null): Promise<PostComment> =>
  (await api.post<PostComment>(`/social/comments/post/${postId}`, { content, parent_id: parentId || undefined })).data;

export const deleteComment = async (commentId: string) => {
  await api.delete(`/social/comments/${commentId}`);
};

export const searchPosts = async (q: string): Promise<Post[]> => {
  if (!q.trim()) return [];
  return (await api.get<Post[]>('/search/posts', { params: { q: q.trim() } })).data || [];
};

// ---------- notifications ----------
export const listNotifications = async (): Promise<AppNotification[]> =>
  (await api.get<AppNotification[]>('/social/notifications')).data || [];

export const markNotificationsRead = async () => {
  await api.put('/social/notifications/read-all');
};

export const unreadNotificationCount = async (): Promise<number> =>
  (await api.get<{ count: number }>('/social/notifications/unread-count')).data.count;

export const deleteNotification = async (id: string) => {
  await api.delete(`/social/notifications/${id}`);
};

// ---------- follows ----------
export const getFollowing = async (): Promise<string[]> => {
  try {
    return (await api.get<string[]>('/social/following')).data || [];
  } catch {
    return [];
  }
};

export const toggleFollow = async (userId: string): Promise<string[]> => {
  await api.post(`/social/users/${userId}/follow`);
  return getFollowing();
};

/** follow / unfollow; resolves with the new state */
export const setFollow = async (userId: string): Promise<boolean> =>
  !!(await api.post<{ following: boolean }>(`/social/users/${userId}/follow`)).data.following;

/** follow / unfollow, or request / cancel a request for private accounts */
export const followToggle = async (userId: string): Promise<{ following: boolean; requested: boolean }> =>
  (await api.post<{ following: boolean; requested: boolean }>(`/social/users/${userId}/follow`)).data;

export const getFollowRequests = async (): Promise<SocialUser[]> =>
  (await api.get<SocialUser[]>('/social/follow-requests')).data || [];
export const answerFollowRequest = async (userId: string, accept: boolean) => {
  await api.post(`/social/follow-requests/${userId}/${accept ? 'accept' : 'decline'}`);
};

// ---------- hashtags ----------
export const getTrendingTags = async (): Promise<Array<{ tag: string; posts: number }>> => {
  try { return (await api.get('/social/hashtags/trending')).data || []; } catch { return []; }
};
export const getHashtagPosts = async (tag: string): Promise<Post[]> =>
  (await api.get<Post[]>(`/social/hashtags/${encodeURIComponent(tag)}/posts`)).data || [];

// ---------- stories ----------
export interface Story { id: string; media_url: string; media_type: 'image' | 'video'; caption?: string; created_at: string; expires_at: string; seen: boolean; views_count?: number }
export interface StoryGroup { user: SocialUser; stories: Story[]; all_seen: boolean }
export const getStoryFeed = async (): Promise<StoryGroup[]> => {
  try { return (await api.get<StoryGroup[]>('/stories/feed')).data || []; } catch { return []; }
};
export const getUserStories = async (userId: string): Promise<Story[]> =>
  (await api.get<Story[]>(`/stories/user/${userId}`)).data || [];
export const publishStory = async (file: { uri: string; type: string; name: string }, caption?: string): Promise<Story> => {
  const fd = new FormData();
  fd.append('media', { uri: file.uri, type: file.type, name: file.name } as any);
  if (caption) fd.append('caption', caption);
  return (await api.post<Story>('/stories', fd, { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: (d) => d, timeout: 120000 })).data;
};
export const markStorySeen = (id: string) => api.post(`/stories/${id}/view`).catch(() => {});
export const getStoryViewers = async (id: string): Promise<SocialUser[]> => (await api.get<SocialUser[]>(`/stories/${id}/viewers`)).data || [];
export const deleteStory = async (id: string) => { await api.delete(`/stories/${id}`); };

export interface UserProfile extends SocialUser {
  status?: string;
  joined?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following: boolean;
  follows_me: boolean;
  is_private?: boolean;
  requested?: boolean;
  can_view?: boolean;
  blocked_by_me?: boolean;
}
export const getUserProfile = async (userId: string): Promise<UserProfile> =>
  (await api.get<UserProfile>(`/social/users/${userId}/profile`)).data;

export interface Reactor { emoji: string; user: SocialUser }
export const getReactors = async (kind: 'post' | 'comment', id: string): Promise<Reactor[]> =>
  (await api.get<Reactor[]>(kind === 'post' ? `/social/posts/${id}/reactions` : `/social/comments/${id}/reactions`)).data || [];

export const getSuggestedUsers = async (): Promise<SocialUser[]> => {
  try {
    return (await api.get<SocialUser[]>('/social/suggested-users')).data || [];
  } catch {
    return [];
  }
};

export const social = {
  toggleBookmark, getBookmarks, votePoll, listPosts, getPost, createPost, deletePost, toggleLike, addComment, deleteComment, reactToPost, reactToComment, searchPosts,
  listNotifications, markNotificationsRead, deleteNotification, getFollowing, toggleFollow, setFollow, getUserProfile, getReactors, getSuggestedUsers,
  followToggle, getFollowRequests, answerFollowRequest, getTrendingTags, getHashtagPosts,
  getStoryFeed, getUserStories, publishStory, markStorySeen, getStoryViewers, deleteStory,
};
