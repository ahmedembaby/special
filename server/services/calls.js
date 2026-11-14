// WebRTC signalling over socket.io. Media flows peer-to-peer (TURN relays when needed); the server only relays
// offers/answers/ICE candidates and keeps a call log.
const crypto = require('crypto');
const pool = require('../db');
const rt = require('./realtime');
const { pushToUsers } = require('./push');

const RING_MS = 45 * 1000;
const calls = new Map(); // callId -> { caller, callee, type, answeredAt, timer }
const busy = new Map(); // userId -> callId or group room marker
const groupRooms = new Map(); // roomId -> active group call
const groupByConversation = new Map(); // conversationId -> roomId
const groupUserRoom = new Map(); // userId -> roomId
const MAX_GROUP_PARTICIPANTS = 5;

const other = (c, id) => (c.caller === id ? c.callee : c.caller);

async function finish(callId, status, notifyIds = []) {
  const c = calls.get(callId);
  if (!c) return;
  clearTimeout(c.timer);
  calls.delete(callId);
  busy.delete(c.caller);
  busy.delete(c.callee);
  const duration = c.answeredAt ? Math.round((Date.now() - c.answeredAt) / 1000) : 0;
  try {
    await pool.query('UPDATE calls SET status = ?, duration = ? WHERE id = ?', [status, duration, callId]);
  } catch (e) { console.warn('call log:', e.message); }
  for (const uid of notifyIds) rt.emitToUser(uid, 'call:ended', { callId, status, duration });
}

async function getGroupMembers(conversationId) {
  const [rows] = await pool.query(
    `SELECT cp.user_id AS id, u.name, u.avatar
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     JOIN users u ON u.id = cp.user_id
     WHERE c.id = ? AND c.type = 'group' AND u.banned = 0`,
    [conversationId]
  );
  return rows;
}

async function finishGroup(roomId, status = 'ended') {
  const room = groupRooms.get(roomId);
  if (!room) return;
  const duration = Math.max(0, Math.round((Date.now() - room.startedAt) / 1000));
  for (const userId of room.participants.keys()) {
    busy.delete(userId);
    groupUserRoom.delete(userId);
    rt.emitToUser(userId, 'call:group:ended', { roomId, status, duration });
  }
  groupRooms.delete(roomId);
  groupByConversation.delete(String(room.conversationId));
  await pool.query('UPDATE group_calls SET status = ?, ended_at = NOW(), duration = ? WHERE id = ?', [status, duration, room.dbId]).catch(() => {});
}

async function removeGroupParticipant(roomId, userId) {
  const room = groupRooms.get(roomId);
  if (!room || !room.participants.has(userId)) return;
  room.participants.delete(userId);
  busy.delete(userId);
  groupUserRoom.delete(userId);
  for (const peerId of room.participants.keys()) {
    rt.emitToUser(peerId, 'call:group:participant_left', { roomId, userId });
  }
  if (!room.participants.size) await finishGroup(roomId, 'ended');
}

function register(socket) {
  const me = socket.user.id;
  const ack = (cb, payload) => typeof cb === 'function' && cb(payload);

  socket.on('call:invite', async ({ to, type, offer } = {}, cb) => {
    try {
      to = Number(to);
      if (!to || to === me || !offer) return ack(cb, { error: 'Invalid call' });
      if (busy.has(me)) return ack(cb, { error: 'You are already in a call' });
      const [u] = await pool.query('SELECT id FROM users WHERE id = ? AND banned = 0', [to]);
      if (!u.length) return ack(cb, { error: 'User not found' });
      if (busy.has(to)) return ack(cb, { error: 'busy' });
      const callType = type === 'video' ? 'video' : 'audio';
      const [r] = await pool.query('INSERT INTO calls (caller_id, callee_id, type) VALUES (?, ?, ?)', [me, to, callType]);
      const callId = r.insertId;
      const timer = setTimeout(() => finish(callId, 'missed', [me, to]), RING_MS);
      calls.set(callId, { caller: me, callee: to, type: callType, answeredAt: null, timer });
      busy.set(me, callId);
      busy.set(to, callId);
      rt.emitToUser(to, 'call:incoming', {
        callId, type: callType, offer,
        from: { id: me, name: socket.user.name, avatar: socket.user.avatar || null },
      });
      if (!rt.isOnline(to)) {
        pushToUsers([to], {
          title: socket.user.name, body: callType === 'video' ? 'Incoming video call' : 'Incoming voice call',
          data: { type: 'call', callId },
        }).catch(() => {});
      }
      ack(cb, { callId });
    } catch (e) {
      console.warn('call:invite', e.message);
      ack(cb, { error: 'Could not start call' });
    }
  });

  socket.on('call:answer', async ({ callId, answer } = {}) => {
    const c = calls.get(Number(callId));
    if (!c || c.callee !== me || c.answeredAt || !answer) return;
    clearTimeout(c.timer);
    c.answeredAt = Date.now();
    c.timer = null;
    pool.query("UPDATE calls SET status = 'active', answered_at = NOW() WHERE id = ?", [callId]).catch(() => {});
    rt.emitToUser(c.caller, 'call:answered', { callId: Number(callId), answer });
    // other devices of the callee stop ringing
    rt.emitToUser(me, 'call:handled', { callId: Number(callId) });
  });

  socket.on('call:ice', ({ callId, candidate } = {}) => {
    const c = calls.get(Number(callId));
    if (!c || (c.caller !== me && c.callee !== me) || !candidate) return;
    rt.emitToUser(other(c, me), 'call:ice', { callId: Number(callId), candidate });
  });

  socket.on('call:reject', ({ callId } = {}) => {
    const c = calls.get(Number(callId));
    if (!c || c.callee !== me || c.answeredAt) return;
    finish(Number(callId), 'rejected', [c.caller, me]);
  });

  socket.on('call:end', ({ callId } = {}) => {
    const c = calls.get(Number(callId));
    if (!c || (c.caller !== me && c.callee !== me)) return;
    const status = c.answeredAt ? 'ended' : c.caller === me ? 'missed' : 'rejected';
    finish(Number(callId), status, [c.caller, c.callee]);
  });

  socket.on('call:group:start', async ({ conversationId, type } = {}, cb) => {
    try {
      conversationId = Number(conversationId);
      if (!Number.isInteger(conversationId) || conversationId <= 0) return ack(cb, { error: 'Invalid group conversation' });
      const members = await getGroupMembers(conversationId);
      if (!members.some((m) => Number(m.id) === Number(me))) return ack(cb, { error: 'You are not a member of this group' });
      if (busy.has(me)) return ack(cb, { error: 'You are already in a call' });
      const existingRoomId = groupByConversation.get(String(conversationId));
      if (existingRoomId && groupRooms.has(existingRoomId)) return ack(cb, { error: 'A group call is already active', roomId: existingRoomId });
      const roomId = crypto.randomUUID();
      const callType = type === 'video' ? 'video' : 'audio';
      const [created] = await pool.query(
        'INSERT INTO group_calls (conversation_id, room_id, started_by, type) VALUES (?, ?, ?, ?)',
        [conversationId, roomId, me, callType]
      );
      const room = { dbId: created.insertId, roomId, conversationId, type: callType, startedBy: me, startedAt: Date.now(), participants: new Map() };
      room.participants.set(me, { id: me, name: socket.user.name, avatar: socket.user.avatar || null });
      groupRooms.set(roomId, room);
      groupByConversation.set(String(conversationId), roomId);
      groupUserRoom.set(me, roomId);
      busy.set(me, 'group:' + roomId);
      const invitees = members.filter((m) => Number(m.id) !== Number(me));
      for (const member of invitees) {
        const payload = { roomId, conversationId, type: callType, from: { id: me, name: socket.user.name, avatar: socket.user.avatar || null }, participantCount: 1 };
        rt.emitToUser(member.id, 'call:group:incoming', payload);
      }
      const offline = invitees.filter((m) => !rt.isOnline(m.id)).map((m) => m.id);
      if (offline.length) pushToUsers(offline, {
        title: socket.user.name || 'Group call',
        body: callType === 'video' ? 'Incoming group video call' : 'Incoming group voice call',
        data: { type: 'group_call', roomId, conversationId },
      }).catch(() => {});
      ack(cb, { roomId, conversationId, type: callType, peers: [], participants: [...room.participants.values()] });
    } catch (error) {
      console.warn('call:group:start', error.message);
      ack(cb, { error: 'Could not start group call' });
    }
  });

  socket.on('call:group:join', async ({ roomId, conversationId } = {}, cb) => {
    try {
      conversationId = Number(conversationId);
      const room = groupRooms.get(String(roomId));
      if (!room || room.conversationId !== conversationId) return ack(cb, { error: 'This group call is no longer active' });
      const members = await getGroupMembers(conversationId);
      if (!members.some((m) => Number(m.id) === Number(me))) return ack(cb, { error: 'You are not a member of this group' });
      if (busy.has(me) && groupUserRoom.get(me) !== String(roomId)) return ack(cb, { error: 'You are already in a call' });
      if (room.participants.has(me)) return ack(cb, { roomId, conversationId, type: room.type, peers: [...room.participants.keys()].filter((id) => id !== me), participants: [...room.participants.values()] });
      if (room.participants.size >= MAX_GROUP_PARTICIPANTS) return ack(cb, { error: 'This group call is full (maximum 5 participants)' });
      const peers = [...room.participants.values()];
      const self = { id: me, name: socket.user.name, avatar: socket.user.avatar || null };
      room.participants.set(me, self);
      groupUserRoom.set(me, String(roomId));
      busy.set(me, 'group:' + roomId);
      for (const peer of peers) rt.emitToUser(peer.id, 'call:group:participant_joined', { roomId, participant: self });
      ack(cb, { roomId, conversationId, type: room.type, peers: peers.map((p) => p.id), participants: [...room.participants.values()] });
    } catch (error) {
      console.warn('call:group:join', error.message);
      ack(cb, { error: 'Could not join group call' });
    }
  });

  socket.on('call:group:offer', ({ roomId, targetId, offer } = {}) => {
    const room = groupRooms.get(String(roomId));
    targetId = Number(targetId);
    if (!room || !room.participants.has(me) || !room.participants.has(targetId) || !offer) return;
    rt.emitToUser(targetId, 'call:group:offer', { roomId, fromId: me, offer });
  });

  socket.on('call:group:answer', ({ roomId, targetId, answer } = {}) => {
    const room = groupRooms.get(String(roomId));
    targetId = Number(targetId);
    if (!room || !room.participants.has(me) || !room.participants.has(targetId) || !answer) return;
    rt.emitToUser(targetId, 'call:group:answer', { roomId, fromId: me, answer });
  });

  socket.on('call:group:ice', ({ roomId, targetId, candidate } = {}) => {
    const room = groupRooms.get(String(roomId));
    targetId = Number(targetId);
    if (!room || !room.participants.has(me) || !room.participants.has(targetId) || !candidate) return;
    rt.emitToUser(targetId, 'call:group:ice', { roomId, fromId: me, candidate });
  });

  socket.on('call:group:leave', async ({ roomId } = {}) => {
    const id = String(roomId || groupUserRoom.get(me) || '');
    if (id && groupUserRoom.get(me) === id) await removeGroupParticipant(id, me);
  });

  socket.on('call:group:end', async ({ roomId } = {}) => {
    const id = String(roomId || groupUserRoom.get(me) || '');
    const room = groupRooms.get(id);
    if (room && room.startedBy === me) await finishGroup(id, 'ended');
  });

  socket.on('disconnect', () => {
    const groupRoomId = groupUserRoom.get(me);
    if (groupRoomId && !rt.isOnline(me)) removeGroupParticipant(groupRoomId, me).catch(() => {});
    const id = busy.get(me);
    if (id && !rt.isOnline(me)) {
      const c = calls.get(id);
      if (c) finish(id, c.answeredAt ? 'ended' : 'missed', [other(c, me)]);
    }
  });
}

module.exports = { register };
