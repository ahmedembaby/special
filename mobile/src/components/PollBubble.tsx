import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppColors } from '../theme/useAppColors';
import * as api from '../services/api';

/** A poll inside a chat message: tap an option to vote, tap it again to take the vote back. */
export const PollBubble = ({ question, poll, isOwn, onVote, accent }: {
  question: string; poll: api.Poll; isOwn?: boolean; onVote: (optionId: number) => void; accent?: string;
}) => {
  const { c } = useAppColors();
  const fg = isOwn ? '#FFFFFF' : c.text;
  const sub = isOwn ? 'rgba(255,255,255,0.8)' : c.textSecondary;
  const bar = isOwn ? 'rgba(255,255,255,0.35)' : (accent || c.primary);
  const track = isOwn ? 'rgba(255,255,255,0.15)' : c.inputBg;
  return (
    <View style={[styles.wrap, { backgroundColor: isOwn ? (accent || c.primary) : c.card }]}>
      <Text style={[styles.tag, { color: sub }]}>📊 POLL</Text>
      <Text style={[styles.q, { color: fg }]}>{question}</Text>
      {poll.options.map((o) => {
        const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
        return (
          <TouchableOpacity key={o.id} activeOpacity={0.8} onPress={() => onVote(o.id)} style={[styles.opt, { backgroundColor: track, borderColor: o.my ? (isOwn ? '#FFFFFF' : c.primary) : 'transparent' }]}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: bar, opacity: isOwn ? 1 : 0.22 }]} />
            <Text style={[styles.optText, { color: fg }]} numberOfLines={2}>{o.my ? '✓ ' : ''}{o.text}</Text>
            <Text style={[styles.pct, { color: sub }]}>{o.votes > 0 ? `${pct}%` : ''}</Text>
          </TouchableOpacity>
        );
      })}
      <Text style={[styles.total, { color: sub }]}>{poll.total} {poll.total === 1 ? 'vote' : 'votes'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderRadius: 22, padding: 14, width: 270 },
  tag: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },
  q: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  opt: { borderRadius: 12, borderWidth: 1.5, marginTop: 6, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optText: { flex: 1, fontSize: 14, fontWeight: '600' },
  pct: { fontSize: 12, fontWeight: '700', marginLeft: 8 },
  total: { fontSize: 12, marginTop: 10 },
});
