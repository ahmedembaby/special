import { useCallback, useMemo, useState } from 'react';
import { RichText } from '../components/RichText';
import { View, Text, FlatList, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { useMe } from '../hooks/useMe';
import * as social from '../services/social';
import { ScreenHeader } from '../components/ScreenHeader';
import { PostCard } from '../components/PostCard';
import { PostComposer } from '../components/PostComposer';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { ReactionsSheet } from '../components/ReactionsSheet';
import { ReactionButton, ReactionSummary, ReactionState, applyReaction } from '../components/ReactionButton';
import { timeAgo } from '../utils/format';

export default function PostDetailScreen() {
  const nav = useNavigation() as any;
  const { postId } = (useRoute() as any).params as { postId: string };
  const { c } = useAppColors();
  const me = useMe();
  const [post, setPost] = useState<social.Post | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setPost(await social.getPost(postId));
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const like = async () => {
    setPost((p) => p && { ...p, likes: p.likes.includes(me.id) ? p.likes.filter((l) => l !== me.id) : [...p.likes, me.id] });
    social.toggleLike(me, postId).catch(() => load());
  };

  const [replyTo, setReplyTo] = useState<social.PostComment | null>(null);

  const reply = async (text: string) => {
    const cm = await social.addComment(me, postId, text, replyTo?.id);
    setPost((p) => p && { ...p, comments: [...p.comments, cm], comments_count: (p.comments_count || p.comments.length) + 1 });
    setReplyTo(null);
  };

  const removeComment = (cm: social.PostComment) =>
    Alert.alert('Delete comment', cm.parentId ? 'Delete this reply?' : 'Delete this comment and its replies?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await social.deleteComment(cm.id);
            setPost((p) => p && { ...p, comments: p.comments.filter((x) => x.id !== cm.id && x.parentId !== cm.id) });
          } catch {
            Alert.alert('Error', 'Could not delete the comment.');
          }
        },
      },
    ]);

  // Threads: each top-level comment followed by its replies (oldest first)
  const thread = useMemo(() => {
    const all = post?.comments || [];
    const roots = all.filter((x) => !x.parentId);
    const byParent: Record<string, social.PostComment[]> = {};
    all.filter((x) => x.parentId).forEach((x) => (byParent[x.parentId as string] = byParent[x.parentId as string] || []).push(x));
    return roots.flatMap((r) => [r, ...(byParent[r.id] || [])]);
  }, [post?.comments]);

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: c.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Post" onBack={() => nav.goBack()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      ) : !post ? (
        <Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 40 }}>This post is no longer available.</Text>
      ) : (
        <>
          <FlatList
            data={thread}
            keyExtractor={(cm) => cm.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <PostCard
                post={post}
                meId={me.id}
                detail
                onLike={like}
                onDelete={async (id) => { await social.deletePost(id); nav.goBack(); }}
                onComment={() => setReplyTo(null)}
              />
            }
            renderItem={({ item }) => {
              const isReply = !!item.parentId;
              const canDelete = item.user.id === me.id || post.user.id === me.id;
              return (
                <View style={[styles.comment, isReply && styles.reply, { borderBottomColor: c.border }]}>
                  <Avatar source={item.user.avatar} name={item.user.name} size={isReply ? 30 : 38} userId={item.user.id} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '800' }} numberOfLines={1}>
                      {item.user.name} <Text style={{ color: c.textSecondary, fontWeight: '400' }}>@{item.user.username} · {timeAgo(item.createdAt)}</Text>
                    </Text>
                    {item.replyTo ? (
                      <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 1 }}>
                        Replying to <Text style={{ color: c.primary }}>@{item.replyTo.username}</Text>
                      </Text>
                    ) : null}
                    <RichText text={item.content} style={{ color: c.text, fontSize: 15, lineHeight: 21, marginTop: 2 }} />
                    <CommentReactions comment={item} color={c.textSecondary} likedColor={c.like} />
                    <View style={styles.cActions}>
                      <TouchableOpacity onPress={() => setReplyTo(item)} hitSlop={8}>
                        <Text style={{ color: c.textSecondary, fontWeight: '700', fontSize: 13 }}>Reply</Text>
                      </TouchableOpacity>
                      {canDelete ? (
                        <TouchableOpacity onPress={() => removeComment(item)} hitSlop={8}>
                          <Text style={{ color: c.textSecondary, fontSize: 13 }}>Delete</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            }}
          />
          {replyTo ? (
            <View style={[styles.replyBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
              <Text style={{ color: c.textSecondary, flex: 1 }} numberOfLines={1}>
                Replying to <Text style={{ color: c.primary, fontWeight: '700' }}>@{replyTo.user.username}</Text>: {replyTo.content}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10}>
                <Icon name="close" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}
          <PostComposer
            key={replyTo ? `r${replyTo.id}` : 'root'}
            me={me}
            onPost={reply}
            autoFocus={!!replyTo}
            placeholder={replyTo ? `Reply to @${replyTo.user.username}` : 'Post your reply'}
            buttonLabel="Reply"
            allowImage={false}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

/** Heart / multi-reaction button for one comment, with the reactions summary under it. */
function CommentReactions({ comment, color, likedColor }: { comment: social.PostComment; color: string; likedColor: string }) {
  const initial = (): ReactionState => ({ my: comment.my_reaction ?? null, count: comment.likes_count ?? 0, reactions: comment.reactions ?? [] });
  const [rx, setRx] = useState<ReactionState>(initial);
  const [sheet, setSheet] = useState(false);
  const [seen, setSeen] = useState(comment.id);
  if (seen !== comment.id) { setSeen(comment.id); setRx(initial()); }

  const react = async (emoji: string) => {
    const prev = rx;
    setRx(applyReaction(prev, emoji));
    try {
      const r = await social.reactToComment(comment.id, emoji);
      setRx({ my: r.reaction, count: r.likes_count, reactions: r.reactions });
    } catch {
      setRx(prev);
    }
  };

  if (String(comment.id).startsWith('temp-')) return null;
  return (
    <View style={{ marginTop: 6 }}>
      <ReactionSummary reactions={rx.reactions} color={color} onPress={() => setSheet(true)} />
      <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
        <ReactionButton state={rx} onReact={react} onCountPress={() => setSheet(true)} color={color} likedColor={likedColor} size={16} hideCount={false} />
      </View>
      {sheet ? <ReactionsSheet kind="comment" id={comment.id} onClose={() => setSheet(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  reply: { paddingLeft: 58 },
  cActions: { flexDirection: 'row', gap: 22, marginTop: 10 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  comment: { flexDirection: 'row', gap: 13, paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth },
});
