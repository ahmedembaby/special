import { ImageViewer } from './ImageViewer';
import { RichText } from './RichText';
import { ReportSheet, ReportTarget } from './ReportSheet';
import { OptionSheet } from './OptionSheet';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Alert, StyleSheet, Share, Modal, TextInput } from 'react-native';
import { Post } from '../services/social';
import * as social from '../services/social';
import { timeAgo, formatCount } from '../utils/format';
import { useAppColors } from '../theme/useAppColors';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { ReactionsSheet } from './ReactionsSheet';
import { ReactionButton, ReactionSummary, ReactionState, applyReaction } from './ReactionButton';
import { resolveUrl } from '../config';

interface Props {
  post: Post;
  meId: string;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onComment: (post: Post) => void;
  onPress?: (post: Post) => void;
  onUserPress?: (username: string) => void;
  detail?: boolean;
}

export const PostCard = ({ post, meId, onLike, onDelete, onComment, onPress, onUserPress, detail }: Props) => {
  const { c } = useAppColors();
  const initialReaction = (): ReactionState => ({
    my: post.my_reaction ?? (post.likes.includes(meId) ? '❤️' : null),
    count: post.likes_count ?? post.likes.length,
    reactions: post.reactions ?? (post.likes.length ? [{ emoji: '❤️', count: post.likes.length }] : []),
  });
  // Reactions are handled here (optimistic, then reconciled with the server) so every screen behaves the same
  const [rx, setRx] = useState<ReactionState>(initialReaction);
  useEffect(() => { setRx(initialReaction()); }, [post.id, post.my_reaction, post.likes_count, post.likes.length]);
  const react = async (emoji: string) => {
    const prev = rx;
    setRx(applyReaction(prev, emoji));
    try {
      const r = await social.reactToPost(post.id, emoji);
      setRx({ my: r.reaction, count: r.likes_count, reactions: r.reactions });
    } catch {
      setRx(prev);
    }
  };
  const own = post.user.id === meId;

  const confirmDelete = () =>
    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(post.id) },
    ]);

  const share = () => Share.share({ message: `${post.user.name} (@${post.user.username}): ${post.content}` }).catch(() => {});
  const imgs = (post.images && post.images.length ? post.images : post.image ? [post.image] : []).map((u) => resolveUrl(u) as string).filter(Boolean);
  const [startIndex, setStartIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [report, setReport] = useState<ReportTarget>(null);
  const nav = useNavigation() as any;
  const [repostMenu, setRepostMenu] = useState(false);
  const [bookmarked, setBookmarked] = useState(!!post.bookmarked);
  const [poll, setPoll] = useState(post.poll);
  const [content, setContent] = useState(post.content);
  const [edited, setEdited] = useState(!!(post as any).edited);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const saveEdit = async () => {
    const text = draft.trim();
    if (!text) return;
    try { await social.editPost(post.id, text); setContent(text); setEdited(true); setEditing(false); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.message || 'Could not edit the post'); }
  };
  const vote = async (optionId: string) => {
    try { const p = await social.votePoll(post.id, optionId); setPoll(p.poll); } catch { Alert.alert('Error', 'Could not vote'); }
  };
  const bookmark = async () => { try { setBookmarked(await social.toggleBookmark(post.id)); } catch { /* offline */ } };
  const repostNow = async () => {
    try { await social.createPost({} as any, '', null, { repostOf: post.id }); Alert.alert('Reposted', 'Shared to your profile.'); }
    catch { Alert.alert('Error', 'Could not repost'); }
  };
  // The viewer keeps its own counters so the heart/comment numbers move immediately,
  // whichever screen owns the post list.
  const [vComments, setVComments] = useState(0);
  const openViewer = (i = 0) => {
    setStartIndex(i);
    setVComments(post.comments_count ?? post.comments.length);
    setViewer(true);
  };
  const viewerActions = {
    reaction: rx,
    onReact: react,
    comments: vComments,
    onSendComment: async (text: string) => { await social.addComment(null as any, post.id, text); setVComments((n) => n + 1); },
    onOpenComments: () => { setViewer(false); onComment(post); },
  };

  const Action = ({ icon, count, color, onPress: onP }: { icon: any; count?: number; color: string; onPress?: () => void }) => (
    <TouchableOpacity style={styles.action} onPress={onP} hitSlop={8} activeOpacity={0.6}>
      <Icon name={icon} size={18} color={color} />
      {count !== undefined && count > 0 ? <Text style={[styles.count, { color }]}>{formatCount(count)}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={() => onPress?.(post)}
      style={[styles.card, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow }]}
    >
      <Avatar source={post.user.avatar} name={post.user.name} size={44} userId={post.user.id} />
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{post.user.name}</Text>
            {post.user.verified ? <Icon name="verified" size={15} color={c.primary} strokeWidth={1.2} /> : null}
            <Text style={[styles.meta, { color: c.textSecondary }]} numberOfLines={1}>
              {' '}@{post.user.username} · {timeAgo(post.createdAt)}{edited ? ' · edited' : ''}
            </Text>
          </View>
          {own ? (
            <View style={{ flexDirection: 'row', gap: 14 }}>
              {!post.repost_of ? (
                <TouchableOpacity onPress={() => { setDraft(content); setEditing(true); }} hitSlop={10}>
                  <Icon name="edit" size={17} color={c.textSecondary} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={confirmDelete} hitSlop={10}>
                <Icon name="trash" size={17} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setReport({ type: 'post', id: post.id })} hitSlop={10}>
              <Icon name="flag" size={17} color={c.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {content ? <RichText text={content} style={[styles.content, { color: c.text, fontSize: detail ? 18 : 15 }]} /> : null}
        {post.repost_of ? (
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, marginTop: 6 }}>
            {post.repost_of.deleted ? (
              <Text style={{ color: c.textSecondary }}>This post is no longer available.</Text>
            ) : (
              <>
                <Text style={{ color: c.text, fontWeight: '700' }}>{post.repost_of.user?.name} <Text style={{ color: c.textSecondary, fontWeight: '400' }}>@{post.repost_of.user?.username}</Text></Text>
                {post.repost_of.content ? <RichText text={post.repost_of.content} style={{ color: c.text, marginTop: 2 }} /> : null}
              </>
            )}
          </View>
        ) : null}
        {poll ? (
          <View style={{ gap: 6, marginTop: 8 }}>
            {poll.options.map((o) => {
              const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
              const mine = poll.my_vote === o.id;
              return (
                <TouchableOpacity key={o.id} activeOpacity={0.8} onPress={() => vote(o.id)} style={{ borderWidth: 1, borderColor: mine ? c.primary : c.border, borderRadius: 10, overflow: 'hidden' }}>
                  {poll.my_vote ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: c.primary, opacity: 0.18 }} /> : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10 }}>
                    <Text style={{ color: c.text, fontWeight: mine ? '800' : '500' }}>{o.text}{mine ? ' ✓' : ''}</Text>
                    {poll.my_vote ? <Text style={{ color: c.textSecondary }}>{pct}%</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>{poll.total} votes</Text>
          </View>
        ) : null}
        {imgs.length ? (
          <View style={[styles.grid, { borderColor: c.border }]}>
            {imgs.length === 1 ? (
              <TouchableOpacity activeOpacity={0.9} onPress={() => openViewer(0)}>
                <Image source={{ uri: imgs[0] }} style={styles.single} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <View style={styles.gridRow}>
                <View style={styles.col}>
                  {imgs.filter((_, i) => i % 2 === 0).map((u) => {
                    const i = imgs.indexOf(u);
                    return (
                      <TouchableOpacity key={u + i} activeOpacity={0.9} style={{ flex: 1 }} onPress={() => openViewer(i)}>
                        <Image source={{ uri: u }} style={styles.cell} resizeMode="cover" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.col}>
                  {imgs.filter((_, i) => i % 2 === 1).map((u) => {
                    const i = imgs.indexOf(u);
                    return (
                      <TouchableOpacity key={u + i} activeOpacity={0.9} style={{ flex: 1 }} onPress={() => openViewer(i)}>
                        <Image source={{ uri: u }} style={styles.cell} resizeMode="cover" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        ) : null}
        <ReportSheet target={report} onClose={() => setReport(null)} />
        <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: c.background, borderRadius: 14, padding: 16 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>Edit post</Text>
              <TextInput value={draft} onChangeText={setDraft} multiline maxLength={1000} style={{ color: c.text, borderColor: c.inputBorder, borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 90, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 14 }}>
                <TouchableOpacity onPress={() => setEditing(false)}><Text style={{ color: c.textSecondary, fontSize: 15 }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveEdit}><Text style={{ color: c.primary, fontSize: 15, fontWeight: '700' }}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {sheet ? <ReactionsSheet kind="post" id={post.id} onClose={() => setSheet(false)} /> : null}
        {viewer ? <ImageViewer uris={imgs} initialIndex={startIndex} onClose={() => setViewer(false)} actions={viewerActions} /> : null}

        {detail ? <ReactionSummary reactions={rx.reactions} color={c.textSecondary} onPress={() => setSheet(true)} /> : null}
        <View style={styles.actions}>
          <Action icon="messageCircle" count={detail ? post.comments.length : post.comments_count ?? post.comments.length} color={c.textSecondary} onPress={() => onComment(post)} />
          <Action icon="repeat" count={post.reposts} color={c.textSecondary} onPress={() => setRepostMenu(true)} />
          <ReactionButton state={rx} onReact={react} onCountPress={() => setSheet(true)} color={c.textSecondary} likedColor={c.like} size={18} textStyle={styles.count} />
          <Action icon="bookmark" color={bookmarked ? c.primary : c.textSecondary} onPress={bookmark} />
          <Action icon="share" color={c.textSecondary} onPress={share} />
          <OptionSheet visible={repostMenu} options={[{ label: 'Repost', onPress: repostNow }, { label: 'Quote', onPress: () => nav.navigate('Compose', { quote: post }) }]} onClose={() => setRepostMenu(false)} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', marginHorizontal: 18, marginTop: 10, paddingHorizontal: 17, paddingVertical: 17, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, gap: 13 },
  body: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 3 },
  name: { fontSize: 15.5, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
  meta: { fontSize: 14, flexShrink: 2 },
  content: { lineHeight: 23, marginTop: 4, fontSize: 15 },
  grid: { marginTop: 12, borderRadius: 20, overflow: 'hidden' },
  single: { width: '100%', height: 200 },
  gridRow: { flexDirection: 'row', height: 220, gap: 2 },
  col: { flex: 1, gap: 2 },
  cell: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingRight: 18 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 44 },
  count: { fontSize: 13 },
});
