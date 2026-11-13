import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { Icon } from './Icon';
import { REACTIONS } from '../services/social';

export interface ReactionState {
  my: string | null;
  count: number;
  reactions: { emoji: string; count: number }[];
}

interface Props {
  state: ReactionState;
  onReact: (emoji: string) => void;
  color: string;
  likedColor: string;
  size?: number;
  textStyle?: any;
  /** hide the number next to the icon */
  hideCount?: boolean;
  /** tapping the number opens the list of people who reacted */
  onCountPress?: () => void;
}

const HEART = REACTIONS[0];

/**
 * Like button with multiple reactions.
 * Tap: heart on/off (a reaction you already gave is removed). Long press: pick a reaction.
 */
export const ReactionButton = ({ state, onReact, color, likedColor, size = 18, textStyle, hideCount, onCountPress }: Props) => {
  const ref = useRef<View>(null);
  const { width } = useWindowDimensions();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const open = () => {
    ref.current?.measureInWindow((x, y) => setPos({ x, y }));
  };
  const pick = (emoji: string) => { setPos(null); onReact(emoji); };

  const my = state.my;
  const active = !!my;
  const BUBBLE_W = REACTIONS.length * 46 + 16;
  const left = pos ? Math.min(Math.max(8, pos.x - 12), width - BUBBLE_W - 8) : 0;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        ref={ref as any}
        style={styles.btn}
        onPress={() => onReact(my || HEART)}
        onLongPress={open}
        delayLongPress={280}
        hitSlop={8}
        activeOpacity={0.6}
      >
        {my && my !== HEART ? (
          <Text style={{ fontSize: size }}>{my}</Text>
        ) : (
          <Icon name={my === HEART ? 'heartFill' : 'heart'} size={size} color={active ? likedColor : color} />
        )}
      </TouchableOpacity>
      {!hideCount && state.count > 0 ? (
        <TouchableOpacity onPress={onCountPress} disabled={!onCountPress} hitSlop={8} style={{ marginLeft: -4 }}>
          <Text style={[styles.count, { color: active ? likedColor : color }, textStyle]}>{state.count}</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={!!pos} transparent animationType="fade" onRequestClose={() => setPos(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPos(null)}>
          {pos ? (
            <View style={[styles.bubble, { left, top: Math.max(60, pos.y - 62), width: BUBBLE_W }]}>
              {REACTIONS.map((e) => (
                <TouchableOpacity key={e} onPress={() => pick(e)} style={[styles.emojiBtn, my === e && styles.emojiOn]} activeOpacity={0.6}>
                  <Text style={styles.emoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
};

/** "❤️ 5  😂 2" summary of who reacted with what */
export const ReactionSummary = ({ reactions, color, onPress }: { reactions: { emoji: string; count: number }[]; color: string; onPress?: () => void }) =>
  reactions.length ? (
    <TouchableOpacity style={styles.summary} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      {reactions.map((r) => (
        <Text key={r.emoji} style={{ color, fontSize: 13 }}>{r.emoji} {r.count}</Text>
      ))}
    </TouchableOpacity>
  ) : null;

/** Local optimistic update of a reaction state when `emoji` is tapped. */
export const applyReaction = (s: ReactionState, emoji: string): ReactionState => {
  const list = s.reactions.map((r) => ({ ...r }));
  const dec = (e: string) => {
    const r = list.find((x) => x.emoji === e);
    if (r) r.count -= 1;
  };
  let my: string | null = emoji;
  let count = s.count;
  if (s.my === emoji) { dec(emoji); my = null; count -= 1; }
  else if (s.my) { dec(s.my); }
  else count += 1;
  if (my) {
    const r = list.find((x) => x.emoji === my);
    if (r) r.count += 1; else list.push({ emoji: my, count: 1 });
  }
  return { my, count, reactions: list.filter((r) => r.count > 0).sort((a, b) => b.count - a.count) };
};

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { fontSize: 13 },
  bubble: {
    position: 'absolute', flexDirection: 'row', padding: 8, borderRadius: 30, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  emojiBtn: { width: 46, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  emojiOn: { backgroundColor: 'rgba(29,155,240,0.15)' },
  emoji: { fontSize: 28 },
  summary: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 6 },
});
