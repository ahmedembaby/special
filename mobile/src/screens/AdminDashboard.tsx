import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, ScrollView, StatusBar, StyleSheet, ActivityIndicator,
  Alert, TextInput, RefreshControl, FlatList, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import { resolveUrl } from '../config';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';

type Tab = 'overview' | 'users' | 'content' | 'reports' | 'audit';
type ContentKind = 'posts' | 'groups' | 'chats';
const PAGE = 30;

const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;
const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

/** Admin dashboard: overview + broadcast, user management, content moderation. */
export default function AdminDashboard() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const s = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!user?.is_admin) {
      Alert.alert('Access denied', 'Admins only');
      navigation.goBack();
    }
  }, []);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[s.header, { borderBottomColor: c.border, flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={{ padding: 6 }}>
          <Icon name="arrowLeft" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>{t('Admin dashboard')}</Text>
      </View>
      <View style={[s.tabs, { borderBottomColor: c.border }]}>
        {(['overview', 'users', 'content', 'reports', 'audit'] as Tab[]).map((key) => (
          <TouchableOpacity key={key} style={s.tab} onPress={() => setTab(key)} activeOpacity={0.7}>
            <Text style={{ color: tab === key ? c.primary : c.textSecondary, fontWeight: '800', textTransform: 'capitalize' }}>{t(key.charAt(0).toUpperCase() + key.slice(1))}</Text>
            {tab === key ? <View style={[s.tabLine, { backgroundColor: c.primary }]} /> : null}
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'overview' ? <Overview c={c} s={s} t={t} /> : tab === 'users' ? <Users c={c} s={s} /> : tab === 'reports' ? <Reports c={c} s={s} /> : tab === 'audit' ? <AuditLog c={c} s={s} /> : <Content c={c} s={s} />}
    </SafeAreaView>
  );
}

/* ---------------------------------- Overview ---------------------------------- */

function Bars({ title, data, c, s }: { title: string; data: { date: string; count: number }[]; c: any; s: any }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, d) => a + d.count, 0);
  return (
    <View style={[s.card, { backgroundColor: c.surface }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[s.cardTitle, { color: c.text }]}>{title}</Text>
        <Text style={{ color: c.textSecondary }}>{total} / 7 days</Text>
      </View>
      <View style={s.barsRow}>
        {data.map((d) => (
          <View key={d.date} style={s.barCol}>
            <Text style={{ color: c.textSecondary, fontSize: 11 }}>{d.count}</Text>
            <View style={[s.bar, { height: 6 + (d.count / max) * 60, backgroundColor: c.primary }]} />
            <Text style={{ color: c.textMuted, fontSize: 11 }}>{d.date.slice(8)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Overview({ c, s, t }: { c: any; s: any; t: (value: string) => string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const [wa, setWa] = useState<any>(null);
  const loadWa = useCallback(async () => {
    try { setWa((await api.get('/whatsapp/status')).data); } catch { setWa(null); }
  }, []);
  // while the QR code is on screen, poll until the phone has scanned it
  useEffect(() => {
    loadWa();
    const t = setInterval(() => { if (!wa?.ready) loadWa(); }, 4000);
    return () => clearInterval(t);
  }, [loadWa, wa?.ready]);
  const waAction = async (a: 'restart' | 'logout') => {
    try { await api.post(`/whatsapp/${a}`); setTimeout(loadWa, 1500); } catch (e) { Alert.alert('Error', errMsg(e, 'Failed')); }
  };

  const load = useCallback(async () => {
    try {
      setStats((await api.get('/admin/stats')).data);
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Failed to load stats'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!title.trim() || !body.trim()) return Alert.alert('Error', 'Please enter a title and a message');
    Alert.alert('Send broadcast', 'Send this to every active user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          setSending(true);
          try {
            const res = await api.post('/admin/broadcast', { title: title.trim(), body: body.trim() });
            Alert.alert('Sent', res.data?.message || 'Broadcast sent');
            setTitle('');
            setBody('');
          } catch (e) {
            Alert.alert('Error', errMsg(e, 'Failed to send broadcast'));
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />;

  const tiles: [string, any][] = [
    ['Users', stats?.totalUsers], ['Online', stats?.onlineUsers], ['New today', stats?.newUsersToday], ['Banned', stats?.bannedUsers],
    ['Messages', stats?.totalMessages], ['Messages today', stats?.messagesToday], ['Posts', stats?.totalPosts], ['Groups', stats?.totalGroups], ['Conversations', stats?.totalConversations], ['Open reports', stats?.openReports],
  ];

  return (
    <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} />}>
      <View style={s.tiles}>
        {tiles.map(([label, v]) => (
          <View key={label} style={[s.tile, { backgroundColor: c.surface }]}>
            <Text style={[s.tileValue, { color: c.text }]}>{v ?? 0}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>{t(label)}</Text>
          </View>
        ))}
      </View>
      {stats?.activity ? (
        <>
          <Bars title="New users" data={stats.activity.users} c={c} s={s} />
          <Bars title="Messages" data={stats.activity.messages} c={c} s={s} />
          <Bars title="Posts" data={stats.activity.posts} c={c} s={s} />
        </>
      ) : null}

      <Text style={[s.section, { color: c.text }]}>WhatsApp (verification codes)</Text>
      <View style={[s.card, { backgroundColor: c.surface, alignItems: 'center' }]}>
        <Text style={{ color: wa?.ready ? c.success : c.text, fontWeight: '800' }}>
          {wa ? (wa.ready ? `Connected${wa.account ? ` · +${wa.account}` : ''}` : `Status: ${wa.status}`) : 'Status unavailable'}
        </Text>
        {wa?.error && !wa.ready ? <Text style={{ color: c.danger, marginTop: 6, textAlign: 'center' }}>{wa.error}</Text> : null}
        {wa?.qrImage ? (
          <>
            <Image source={{ uri: wa.qrImage }} style={{ width: 240, height: 240, marginTop: 12, backgroundColor: '#fff' }} />
            <Text style={{ color: c.textSecondary, marginTop: 8, textAlign: 'center' }}>WhatsApp › Linked devices › Link a device, then scan.</Text>
          </>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity style={[s.chip, { backgroundColor: c.background }]} onPress={() => waAction('restart')}>
            <Text style={{ color: c.text, fontWeight: '700' }}>Restart</Text>
          </TouchableOpacity>
          {wa?.ready ? (
            <TouchableOpacity
              style={[s.chip, { backgroundColor: c.background }]}
              onPress={() => Alert.alert('Unlink WhatsApp', 'Codes will stop being sent until you scan again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Unlink', style: 'destructive', onPress: () => waAction('logout') }])}
            >
              <Text style={{ color: c.danger, fontWeight: '700' }}>Unlink</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Text style={[s.section, { color: c.text }]}>Broadcast</Text>
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <TextInput placeholder="Title" placeholderTextColor={c.textMuted} value={title} onChangeText={setTitle} style={[s.input, { color: c.text, borderColor: c.border }]} maxLength={80} />
        <TextInput placeholder="Message" placeholderTextColor={c.textMuted} value={body} onChangeText={setBody} style={[s.input, { color: c.text, borderColor: c.border, minHeight: 80, textAlignVertical: 'top' }]} multiline maxLength={300} />
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: c.primary, opacity: sending ? 0.6 : 1 }]} onPress={send} disabled={sending} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>{sending ? 'Sending…' : 'Send to all users'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ------------------------------------ Users ------------------------------------ */

function Users({ c, s }: { c: any; s: any }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'banned'>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const reqId = useRef(0);

  const load = useCallback(async (reset: boolean, offset = 0) => {
    const id = ++reqId.current;
    if (reset) setLoading(true); else setMore(true);
    try {
      const res = await api.get('/admin/users', { params: { q: q.trim() || undefined, filter, limit: PAGE, offset } });
      if (id !== reqId.current) return; // a newer request superseded this one
      setTotal(res.data.total);
      setUsers((prev) => (reset ? res.data.users : [...prev, ...res.data.users]));
    } catch (e) {
      if (id === reqId.current) Alert.alert('Error', errMsg(e, 'Failed to load users'));
    } finally {
      if (id === reqId.current) { setLoading(false); setMore(false); }
    }
  }, [q, filter]);

  useEffect(() => {
    const t = setTimeout(() => load(true), 300); // debounce typing
    return () => clearTimeout(t);
  }, [load]);

  const openUser = async (u: any) => {
    try {
      setSelected((await api.get(`/admin/users/${u.id}`)).data);
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Failed to load user'));
    }
  };

  const toggleBan = (u: any) => {
    const next = !u.banned;
    Alert.alert(next ? 'Ban user' : 'Unban user', `${next ? 'Ban' : 'Unban'} ${u.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: next ? 'Ban' : 'Unban', style: next ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await api.post(`/admin/users/${u.id}/ban`, { banned: next });
            setSelected((p: any) => (p && p.id === u.id ? { ...p, banned: next } : p));
            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, banned: next } : x)));
          } catch (e) {
            Alert.alert('Error', errMsg(e, 'Failed to update user'));
          }
        },
      },
    ]);
  };

  const remove = (u: any) =>
    Alert.alert('Delete user', `Permanently delete ${u.name} and all their data? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/admin/users/${u.id}`);
            setSelected(null);
            setUsers((prev) => prev.filter((x) => x.id !== u.id));
            setTotal((t) => Math.max(0, t - 1));
          } catch (e) {
            Alert.alert('Error', errMsg(e, 'Failed to delete user'));
          }
        },
      },
    ]);

  if (selected) {
    const u = selected;
    return (
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ paddingVertical: 8 }}>
          <Text style={{ color: c.primary, fontWeight: '700' }}>‹ All users</Text>
        </TouchableOpacity>
        <View style={[s.card, { backgroundColor: c.surface, alignItems: 'center' }]}>
          <Avatar u={u} c={c} size={72} />
          <Text style={[s.cardTitle, { color: c.text, marginTop: 10 }]}>{u.name}{u.is_admin ? '  · Admin' : ''}</Text>
          {u.username ? <Text style={{ color: c.textSecondary }}>@{u.username}</Text> : null}
          {u.banned ? <Text style={{ color: c.danger, fontWeight: '700', marginTop: 4 }}>Banned</Text> : null}
          {u.bio ? <Text style={{ color: c.text, marginTop: 8, textAlign: 'center' }}>{u.bio}</Text> : null}
        </View>
        <View style={[s.card, { backgroundColor: c.surface }]}>
          {[['Phone', u.phone], ['Email', u.email], ['Status', u.status], ['Joined', when(u.created_at)], ['Last seen', when(u.last_seen)],
            ['Posts', u.stats?.posts], ['Messages', u.stats?.messages], ['Followers', u.stats?.followers], ['Following', u.stats?.following]].map(([k, v]) => (
            <View key={String(k)} style={s.kv}>
              <Text style={{ color: c.textSecondary }}>{k}</Text>
              <Text style={{ color: c.text, fontWeight: '600' }}>{v ?? '—'}</Text>
            </View>
          ))}
        </View>
        {!u.is_admin ? (
          <View style={{ gap: 10 }}>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: u.banned ? c.primary : c.danger }]} onPress={() => toggleBan(u)}>
              <Text style={s.primaryBtnText}>{u.banned ? 'Unban user' : 'Ban user'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.danger }]} onPress={() => remove(u)}>
              <Text style={[s.primaryBtnText, { color: c.danger }]}>Delete user</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <TextInput placeholder="Search name, username, phone, email" placeholderTextColor={c.textMuted} value={q} onChangeText={setQ} style={[s.input, { color: c.text, borderColor: c.border }]} autoCapitalize="none" />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          {(['all', 'online', 'banned'] as const).map((f) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[s.chip, { backgroundColor: filter === f ? c.primary : c.surface }]}>
              <Text style={{ color: filter === f ? '#fff' : c.text, fontWeight: '700', textTransform: 'capitalize' }}>{f}</Text>
            </TouchableOpacity>
          ))}
          <Text style={{ color: c.textSecondary, alignSelf: 'center', marginLeft: 'auto' }}>{total} users</Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={c.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (!more && users.length < total) load(false, users.length); }}
          ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 30 }}>No users found</Text>}
          ListFooterComponent={more ? <ActivityIndicator color={c.primary} style={{ margin: 12 }} /> : undefined}
          renderItem={({ item: u }) => (
            <TouchableOpacity style={[s.row, { borderBottomColor: c.border }]} onPress={() => openUser(u)} activeOpacity={0.7}>
              <Avatar u={u} c={c} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '700' }} numberOfLines={1}>{u.name}{u.is_admin ? '  · Admin' : ''}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 13 }} numberOfLines={1}>{u.phone || u.email || 'No contact'}</Text>
              </View>
              <Text style={{ color: u.banned ? c.danger : u.status === 'online' ? c.success : c.textMuted, fontSize: 12, fontWeight: '700' }}>
                {u.banned ? 'BANNED' : u.status === 'online' ? 'ONLINE' : ''}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function Avatar({ u, c, size }: { u: any; c: any; size: number }) {
  const uri = resolveUrl(u.avatar);
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size / 2.4 }}>{(u.name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/* ----------------------------------- Content ----------------------------------- */

/* ---------------------------------- Reports ---------------------------------- */

function Reports({ c, s }: { c: any; s: any }) {
  const [items, setItems] = useState<any[] | null>(null);
  const load = useCallback(async () => {
    try { setItems((await api.get('/admin/reports')).data || []); } catch (e) { setItems([]); Alert.alert('Error', errMsg(e, 'Failed to load')); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const resolve = async (r: any, status: 'resolved' | 'dismissed', deleteContent = false) => {
    try {
      await api.post(`/admin/reports/${r.id}/resolve`, { status, delete_content: deleteContent });
      setItems((p) => (p || []).filter((x) => x.id !== r.id));
    } catch (e) { Alert.alert('Error', errMsg(e, 'Failed')); }
  };

  if (items === null) return <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />;
  return (
    <FlatList
      data={items}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 50 }}>No open reports 🎉</Text>}
      renderItem={({ item: r }) => (
        <View style={[s.card, { backgroundColor: c.surface }]}>
          <Text style={{ color: c.text, fontWeight: '800' }}>{r.target_type} #{r.target_id} · {r.reason}</Text>
          <Text style={{ color: c.textSecondary, marginTop: 2 }}>by {r.reporter_name}{r.reporter_username ? ` (@${r.reporter_username})` : ''} · {new Date(r.created_at).toLocaleString()}</Text>
          {r.details ? <Text style={{ color: c.text, marginTop: 6 }}>{r.details}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {r.target_type !== 'user' ? (
              <TouchableOpacity onPress={() => resolve(r, 'resolved', true)}><Text style={{ color: c.danger, fontWeight: '800' }}>Delete content</Text></TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => resolve(r, 'resolved')}><Text style={{ color: c.primary, fontWeight: '800' }}>Mark resolved</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => resolve(r, 'dismissed')}><Text style={{ color: c.textSecondary, fontWeight: '800' }}>Dismiss</Text></TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
}

function AuditLog({ c, s }: { c: any; s: any }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await api.get('/admin/audit');
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      Alert.alert('Error', errMsg(error, 'Failed to load admin activity'));
      setItems((current) => current || []);
    } finally { setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (items === null) return <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />;
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 40 }}>No admin activity recorded</Text>}
      renderItem={({ item }) => (
        <View style={[s.card, { backgroundColor: c.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: c.text, fontWeight: '800' }}>{item.admin_name || 'Administrator'}</Text>
            <Text style={{ color: c.textMuted, fontSize: 11 }}>{item.method}</Text>
          </View>
          <Text style={{ color: c.primary, marginTop: 5, fontWeight: '700' }} numberOfLines={2}>{item.path}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 5 }}>{new Date(item.created_at).toLocaleString()}</Text>
          {item.details ? <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 5 }} numberOfLines={3}>{item.details}</Text> : null}
        </View>
      )}
    />
  );
}

function Content({ c, s }: { c: any; s: any }) {
  const [kind, setKind] = useState<ContentKind>('posts');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');

  const path = kind === 'chats' ? 'conversations' : kind;
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/admin/${path}`, { params: kind === 'posts' ? { q: q.trim() || undefined, limit: 100 } : undefined });
      setItems(res.data || []);
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Failed to load'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [path, kind, q]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const remove = (item: any) => {
    const label = kind === 'posts' ? 'post' : kind === 'groups' ? 'group (and its chat)' : 'conversation';
    Alert.alert(`Delete ${label}`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/admin/${path}/${item.id}`);
            setItems((prev) => prev.filter((x) => x.id !== item.id));
          } catch (e) {
            Alert.alert('Error', errMsg(e, 'Failed to delete'));
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
        {([['posts', 'Posts'], ['groups', 'Groups'], ['chats', 'Chats']] as [ContentKind, string][]).map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => { setKind(k); setItems([]); }} style={[s.chip, { backgroundColor: kind === k ? c.primary : c.surface }]}>
            <Text style={{ color: kind === k ? '#fff' : c.text, fontWeight: '700' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {kind === 'posts' ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <TextInput placeholder="Search posts or authors" placeholderTextColor={c.textMuted} value={q} onChangeText={setQ} style={[s.input, { color: c.text, borderColor: c.border }]} autoCapitalize="none" />
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={c.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 6 }}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 30 }}>Nothing here yet</Text>}
          renderItem={({ item }) => (
            <View style={[s.row, { borderBottomColor: c.border, alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                {kind === 'posts' ? (
                  <>
                    <Text style={{ color: c.text, fontWeight: '700' }}>{item.user_name}{item.username ? `  @${item.username}` : ''}</Text>
                    <Text style={{ color: c.text, marginTop: 2 }} numberOfLines={4}>{item.content}</Text>
                    {item.image ? <Image source={{ uri: resolveUrl(item.image) || undefined }} style={{ width: 160, height: 100, borderRadius: 10, marginTop: 6 }} /> : null}
                    <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 4 }}>{when(item.created_at)} · {item.likes_count} likes · {item.comments_count} comments</Text>
                  </>
                ) : kind === 'groups' ? (
                  <>
                    <Text style={{ color: c.text, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: c.textSecondary, fontSize: 13 }}>{item.type} · {item.member_count} members · owner {item.owner_name || '—'}</Text>
                    <Text style={{ color: c.textMuted, fontSize: 12 }}>Created {when(item.created_at)}</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ color: c.text, fontWeight: '700' }}>{item.type === 'group' ? item.name || 'Group chat' : `Direct chat #${item.id}`}</Text>
                    <Text style={{ color: c.textSecondary, fontSize: 13 }}>{item.participant_count} participants · {item.message_count} messages</Text>
                    <Text style={{ color: c.textMuted, fontSize: 12 }}>Last activity {when(item.last_message_at || item.created_at)}</Text>
                  </>
                )}
              </View>
              {kind === 'chats' && item.type === 'group' ? null : (
                <TouchableOpacity onPress={() => remove(item)} style={[s.delBtn, { borderColor: c.danger }]}>
                  <Text style={{ color: c.danger, fontWeight: '700' }}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLine: { position: 'absolute', bottom: 0, height: 3, width: 40, borderRadius: 2 },
  scroll: { padding: 16, paddingBottom: 50, gap: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, minWidth: 138, padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  tileValue: { fontSize: 26, fontWeight: '800' },
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  section: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10, height: 100 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: 3 },
  bar: { width: 18, borderRadius: 5 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, fontSize: 15, backgroundColor: c.background },
  primaryBtn: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  delBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
});
