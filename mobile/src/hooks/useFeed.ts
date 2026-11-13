import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as social from '../services/social';
import { useMe } from './useMe';
import { cacheGet, cacheSet } from '../services/cache';

/** Loads posts (optionally for one user) and exposes optimistic like / delete / create. */
export const useFeed = (username?: string) => {
  const me = useMe();
  const [posts, setPosts] = useState<social.Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = `feed:${username || 'main'}`;
  // show the last known feed immediately (and offline) while the fresh one loads
  useEffect(() => {
    cacheGet<social.Post[]>(cacheKey).then((c) => { if (c) { setPosts((cur) => (cur.length ? cur : c)); setLoading(false); } });
  }, [cacheKey]);

  const load = useCallback(async () => {
    try {
      const fresh = await social.listPosts(username);
      setPosts(fresh);
      cacheSet(cacheKey, fresh.slice(0, 30));
    } catch {
      // keep what we have; pull-to-refresh retries
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username, cacheKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = () => { setRefreshing(true); load(); };

  const like = (id: string) => {
    setPosts((prev) => prev.map((p) =>
      p.id !== id ? p : { ...p, likes: p.likes.includes(me.id) ? p.likes.filter((l) => l !== me.id) : [...p.likes, me.id] }));
    social.toggleLike(me, id).catch(() => load()); // roll back to the server state on failure
  };

  const remove = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    social.deletePost(id).catch(() => load());
  };

  const create = async (content: string, image: string | string[] | null, extras?: social.PostExtras) => {
    const post = await social.createPost(me, content, image, extras);
    setPosts((prev) => [post, ...prev]);
  };

  return { me, posts, loading, refreshing, refresh, like, remove, create, reload: load };
};
