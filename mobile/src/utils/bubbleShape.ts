/**
 * Corner radii for a chat bubble inside a run of messages from one sender.
 * Only the last bubble of a run keeps the "tail" corner and only the first keeps a full top corner,
 * so a run reads as one stack instead of separate pills.
 */
export const BUBBLE_R = 20;
export const BUBBLE_TAIL_R = 7;

export function bubbleCorners(isOwn: boolean, groupedWithPrev: boolean, groupedWithNext: boolean) {
  const inner = BUBBLE_TAIL_R;
  const side = isOwn ? 'Right' : 'Left';
  const style: Record<string, number> = {};
  style[`borderTop${side}Radius`] = groupedWithPrev ? inner : BUBBLE_R;
  style[`borderBottom${side}Radius`] = groupedWithNext ? inner : BUBBLE_TAIL_R;
  return style;
}
