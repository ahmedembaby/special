import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineMutation } from './useOfflineMutation';
import { social } from '../services/social';
import type { Post, PostComment, AppNotification, SocialUser, Me } from '../services/social';

export const postsKeys = {
  all: ['posts'] as const,
  lists: () => [...postsKeys.all, 'list'] as const,
  list: (username?: string) => [...postsKeys.lists(), { username }] as const,
  user: (username: string) => [...postsKeys.all, 'user', username] as const,
};

export const notificationsKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationsKeys.all, 'list'] as const,
};

export const followKeys = {
  all: ['follows'] as const,
  status: (userId: string) => [...followKeys.all, 'status', userId] as const,
  suggested: () => [...followKeys.all, 'suggested'] as const,
};

export function usePosts(username?: string) {
  return useQuery({
    queryKey: postsKeys.list(username),
    queryFn: () => social.listPosts(username),
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useOfflineMutation<Post, { me: Me; content: string; imageUri?: string | null }>(
    ['social', 'createPost'],
    ({ me, content, imageUri }) => social.createPost(me, content, imageUri),
    {
      onMutate: async ({ me, content, imageUri }: { me: Me; content: string; imageUri?: string | null }) => {
        await queryClient.cancelQueries({ queryKey: postsKeys.lists() });
        const previousPosts = queryClient.getQueryData(postsKeys.lists());
        const optimisticPost: Post = {
          id: `temp-${Date.now()}`,
          content,
          image: imageUri || null,
          createdAt: new Date().toISOString(),
          user: { id: me.id, name: me.name, username: me.username, avatar: me.avatar },
          likes: [],
          comments: [],
          reposts: 0,
        };
        queryClient.setQueryData(postsKeys.lists(), (old: Post[] | undefined) => [optimisticPost, ...(old || [])]);
        return { previousPosts };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      },
    }
  );
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, string>(
    ['social', 'deletePost'],
    (id: string) => social.deletePost(id),
    {
      onMutate: async (id: string) => {
        await queryClient.cancelQueries({ queryKey: postsKeys.lists() });
        const previousPosts = queryClient.getQueryData(postsKeys.lists());
        queryClient.setQueryData(postsKeys.lists(), (old: Post[] | undefined) =>
          (old || []).filter((p) => p.id !== id)
        );
        return { previousPosts };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      },
    }
  );
}

export function useToggleLike(me: Me) {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, string>(
    ['social', 'toggleLike'],
    (postId: string) => social.toggleLike(me, postId).then(() => undefined),
    {
      onMutate: async (postId: string) => {
        await queryClient.cancelQueries({ queryKey: postsKeys.lists() });
        const previousPosts = queryClient.getQueryData(postsKeys.lists());
        queryClient.setQueryData(postsKeys.lists(), (old: Post[] | undefined) =>
          (old || []).map((p) =>
            p.id === postId
              ? {
                  ...p,
                  likes: p.likes.includes(me.id)
                    ? p.likes.filter((l: string) => l !== me.id)
                    : [...p.likes, me.id],
                }
              : p
          )
        );
        return { previousPosts };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      },
    }
  );
}

export function useAddComment(me: Me) {
  const queryClient = useQueryClient();
  return useOfflineMutation<PostComment, { postId: string; content: string }>(
    ['social', 'addComment'],
    ({ postId, content }) => social.addComment(me, postId, content),
    {
      onMutate: async ({ postId, content }: { postId: string; content: string }) => {
        await queryClient.cancelQueries({ queryKey: postsKeys.lists() });
        const previousPosts = queryClient.getQueryData(postsKeys.lists());
        const optimisticComment: PostComment = {
          id: `temp-${Date.now()}`,
          content,
          createdAt: new Date().toISOString(),
          user: { id: me.id, name: me.name, username: me.username, avatar: me.avatar },
        };
        queryClient.setQueryData(postsKeys.lists(), (old: Post[] | undefined) =>
          (old || []).map((p) =>
            p.id === postId ? { ...p, comments: [...p.comments, optimisticComment] } : p
          )
        );
        return { previousPosts };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      },
    }
  );
}

export function useNotifications() {
  return useQuery({
    queryKey: notificationsKeys.list(),
    queryFn: () => social.listNotifications(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useOfflineMutation<void, string>(
    ['social', 'deleteNotification'],
    (id: string) => social.deleteNotification(id),
    {
      onMutate: async (id: string) => {
        await queryClient.cancelQueries({ queryKey: notificationsKeys.list() });
        const previous = queryClient.getQueryData(notificationsKeys.list());
        queryClient.setQueryData(notificationsKeys.list(), (old: AppNotification[] | undefined) =>
          (old || []).filter((n) => n.id !== id)
        );
        return { previous };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: notificationsKeys.list() });
      },
    }
  );
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await social.markNotificationsRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.list() });
    },
  });
}

export function useToggleFollow() {
  const queryClient = useQueryClient();
  return useOfflineMutation<string[], string>(
    ['social', 'toggleFollow'],
    (userId: string) => social.toggleFollow(userId),
    {
      onMutate: async (userId: string) => {
        await queryClient.cancelQueries({ queryKey: followKeys.suggested() });
        await queryClient.cancelQueries({ queryKey: followKeys.status(userId) });
        const previousSuggested = queryClient.getQueryData(followKeys.suggested());
        const previousStatus = queryClient.getQueryData(followKeys.status(userId));
        queryClient.setQueryData(followKeys.suggested(), (old: SocialUser[] | undefined) =>
          (old || []).map((u) => u)
        );
        return { previousSuggested, previousStatus };
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: followKeys.suggested() });
        queryClient.invalidateQueries({ queryKey: followKeys.all });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: followKeys.suggested() });
        queryClient.invalidateQueries({ queryKey: followKeys.all });
      },
    }
  );
}

export function useSuggestedUsers() {
  return useQuery({
    queryKey: followKeys.suggested(),
    queryFn: async () => {
      return [];
    },
    staleTime: 1000 * 60 * 10,
  });
}