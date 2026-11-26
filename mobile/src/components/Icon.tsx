import React from 'react';
import { I18nManager } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

/**
 * Flat vector interface icon set on a consistent 24x24 grid. Keep silhouettes
 * simple, crisp, and consistent; use filled variants for selected navigation states.
 */
export type IconName =
  | 'arrowLeft' | 'arrowRight' | 'chevronDown' | 'chevronRight' | 'close' | 'check' | 'checkRead'
  | 'pen' | 'user' | 'users' | 'userPlus' | 'clock' | 'copy' | 'search' | 'chat' | 'menu'
  | 'camera' | 'image' | 'phone' | 'video' | 'send' | 'logout' | 'lock' | 'bell' | 'bellOff' | 'moon'
  | 'globe' | 'eye' | 'file' | 'help' | 'face' | 'fingerprint' | 'pin' | 'warning' | 'mic'
  | 'edit' | 'trash' | 'messageCircle' | 'repeat' | 'share' | 'heart' | 'home' | 'mail' | 'checkCircle'
  | 'moreHorizontal' | 'sendFeather' | 'imageFeather'
  | 'homeFill' | 'heartFill' | 'bellFill' | 'mailFill' | 'userFill' | 'usersFill' | 'plus' | 'settings' | 'calendar' | 'mapPin'
  | 'attach' | 'play' | 'pause' | 'arrowUp' | 'arrowDown' | 'reply' | 'forward' | 'star' | 'starFill' | 'pinned' | 'checkSquare' | 'square'
  | 'poll' | 'wifiOff' | 'refresh' | 'alertCircle' | 'chevronLeft' | 'sparkle' | 'lockFill' | 'eyeOff' | 'translate'
  | 'verified' | 'bookmark' | 'link' | 'trending' | 'composeFab' | 'x' | 'bubble' | 'sliders' | 'flag' | 'archive';

type Node = { t: 'p'; d: string; fill?: boolean } | { t: 'c'; cx: number; cy: number; r: number; fill?: boolean } | { t: 'r'; x: number; y: number; w: number; h: number; rx: number };
const p = (d: string, fill = false): Node => ({ t: 'p', d, fill });
const c = (cx: number, cy: number, r: number, fill = false): Node => ({ t: 'c', cx, cy, r, fill });

const ICONS: Record<IconName, Node[]> = {
  arrowLeft: [p('M20 12H4M10 6l-6 6 6 6')],
  arrowRight: [p('M4 12h16M14 6l6 6-6 6')],
  chevronDown: [p('M6 9l6 6 6-6')],
  chevronRight: [p('M9 6l6 6-6 6')],
  close: [p('M6 6l12 12M18 6L6 18')],
  check: [p('M5 12.5l4.5 4.5L19 7.5')],
  checkRead: [p('M2 12.5l4.5 4.5L15 8.5M10 16.5l1 .8L21 8')],
  pen: [p('M4 20h4L19.5 8.5a2.1 2.1 0 000-3l-1-1a2.1 2.1 0 00-3 0L4 16v4zM13.5 6.5l4 4')],
  user: [p('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2'), c(12, 7, 4)],
  users: [c(9, 8, 3.5), p('M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18 14.8c2 .7 3.5 2.3 3.5 5.2')],
  userPlus: [c(10, 8, 3.7), p('M3 20c0-3.5 3.1-5.8 7-5.8s7 2.3 7 5.8M19 7v6M16 10h6')],
  clock: [c(12, 12, 9), p('M12 7v5.2l3.2 2')],
  copy: [p('M9 9h10v11H9zM5 15V4h10')],
  search: [c(11, 11, 7), p('M20.5 20.5L16 16')],
  chat: [p('M12 3a9 9 0 00-7.8 13.5L3 21l4.6-1.2A9 9 0 1012 3z')],
  menu: [p('M4 7h16M4 12h16M4 17h16')],
  camera: [p('M4 8h3l1.5-2.5h7L17 8h3v11H4z'), c(12, 13.5, 3.3)],
  image: [p('M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z'), c(8.5, 8.5, 1.5), p('M21 15l-5-5L5 21')],
  phone: [p('M5 4h4l1.5 4.5-2 1.5a11 11 0 005.5 5.5l1.5-2L20 15v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z')],
  video: [p('M3 7h12a1 1 0 011 1v8a1 1 0 01-1 1H3zM16 10.5l5-3v9l-5-3z')],
  send: [p('M3 11.5L21 3l-5 18-4.5-7.5z M11.5 13.5L21 3')],
  logout: [p('M10 4H5v16h5M15 8l4 4-4 4M19 12H9')],
  lock: [p('M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3')],
  bell: [p('M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0')],
  bellOff: [p('M6 17V11a6 6 0 013-5.2M18 11v6l1.5 2H8M10 21h4M4 4l16 16')],
  moon: [p('M20 14.5A8.5 8.5 0 119.5 4a7 7 0 0010.5 10.5z')],
  globe: [c(12, 12, 9), p('M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18')],
  eye: [p('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'), c(12, 12, 3)],
  file: [p('M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6')],
  help: [c(12, 12, 9), p('M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.2-1.5 2.5M12 17v.2')],
  face: [p('M4 9V6a2 2 0 012-2h3M15 4h3a2 2 0 012 2v3M20 15v3a2 2 0 01-2 2h-3M9 20H6a2 2 0 01-2-2v-3M9 10v1.5M15 10v1.5M9 15c1.5 1.5 4.5 1.5 6 0')],
  fingerprint: [p('M6 9a8 8 0 0112 0M4 13a10 10 0 0116 0M8 12a4 4 0 018 0v3a6 6 0 01-1.5 4M12 12v4a5 5 0 01-1 3M8 15v1a8 8 0 001.5 4.5')],
  pin: [p('M7 4v16M17 4v16M3 9h18M3 15h18')],
  warning: [p('M12 3l10 18H2zM12 10v5M12 18v.2')],
  mic: [p('M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z'), p('M19 10v2a7 7 0 01-14 0v-2M12 19v3')],
  edit: [p('M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z')],
  trash: [p('M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6')],
  messageCircle: [p('M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8z')],
  repeat: [p('M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3')],
  share: [p('M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13')],
  heart: [p('M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1 7.8 7.8 7.8-7.8 1-1.1a5.5 5.5 0 000-7.8z')],
  home: [p('M3 9.5L12 2.5l9 7V20a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V13h6v9')],
  mail: [p('M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6.5l-10 7-10-7')],
  checkCircle: [p('M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z'), p('M9 12l2 2 4-4')],
  moreHorizontal: [c(5, 12, 1.2, true), c(12, 12, 1.2, true), c(19, 12, 1.2, true)],
  homeFill: [p('M3 9.5L12 2.5l9 7V20a2 2 0 01-2 2H5a2 2 0 01-2-2z', true)],
  heartFill: [p('M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1 7.8 7.8 7.8-7.8 1-1.1a5.5 5.5 0 000-7.8z', true)],
  bellFill: [p('M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z', true), p('M13.7 21a2 2 0 01-3.4 0')],
  mailFill: [p('M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z', true)],
  userFill: [p('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2z', true), c(12, 7, 4, true)],
  usersFill: [c(9, 8, 3.5, true), p('M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18 14.8c2 .7 3.5 2.3 3.5 5.2', true)],
  plus: [p('M12 5v14M5 12h14')],
  settings: [c(12, 12, 3), p('M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z')],
  calendar: [p('M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM16 2v4M8 2v4M3 10h18')],
  mapPin: [p('M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z'), c(12, 10, 3)],
  verified: [p('M12 2l2.4 1.7 2.9-.1 1 2.7 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-1 2.7-2.9-.1L12 22l-2.4-1.7-2.9.1-1-2.7-2.4-1.7.9-2.8-.9-2.8 2.4-1.7 1-2.7 2.9.1z', true), p('M8.5 12.2l2.5 2.5 4.5-5')],
  bookmark: [p('M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z')],
  flag: [p('M5 21V4m0 0c5-3 9 3 14 0v10c-5 3-9-3-14 0')],
  archive: [p('M3 4h18v4H3zM5 8v12h14V8M10 12h4')],
  link: [p('M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7')],
  trending: [p('M23 6l-9.5 9.5-5-5L1 18M17 6h6v6')],
  composeFab: [p('M12 5v14M5 12h14')],
  x: [p('M6 6l12 12M18 6L6 18')],
  bubble: [p('M12 3a9 9 0 00-7.8 13.5L3 21l4.6-1.2A9 9 0 1012 3z')],
  sliders: [p('M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6')],
  sendFeather: [p('M3 11.5L21 3l-5 18-4.5-7.5z M11.5 13.5L21 3')],
  imageFeather: [p('M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48')],
  attach: [p('M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48')],
  play: [p('M7 4.5l12 7.5-12 7.5z', true)],
  pause: [p('M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', true)],
  arrowUp: [p('M12 20V4M6 10l6-6 6 6')],
  arrowDown: [p('M12 4v16M6 14l6 6 6-6')],
  reply: [p('M9 14L4 9l5-5M20 20v-7a4 4 0 00-4-4H4')],
  forward: [p('M15 14l5-5-5-5M4 20v-7a4 4 0 014-4h16')],
  star: [p('M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z')],
  starFill: [p('M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z', true)],
  pinned: [p('M15 3H9l1 6-3 3v2h10v-2l-3-3zM12 14v7')],
  checkSquare: [p('M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h11')],
  square: [{ t: 'r', x: 4, y: 4, w: 16, h: 16, rx: 3 }],
  poll: [p('M18 20V10M12 20V4M6 20v-6')],
  wifiOff: [p('M1 1l22 22M16.7 11.1A11 11 0 0119 12.6M5 12.6a11 11 0 015.2-2.4M10.7 5.1A16 16 0 0122.6 9M1.4 9a16 16 0 014.7-2.9M8.5 16.1a6 6 0 016.9 0M12 20h.01')],
  refresh: [p('M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15')],
  alertCircle: [c(12, 12, 10), p('M12 8v4M12 16h.01')],
  chevronLeft: [p('M15 18l-6-6 6-6')],
  sparkle: [p('M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z')],
  lockFill: [p('M6 11h12v9H6z', true), p('M8.5 11V8a3.5 3.5 0 017 0v3')],
  eyeOff: [p('M17.9 17.9A10.1 10.1 0 0112 20c-6.5 0-10-8-10-8a18 18 0 014.1-5.1M9.9 4.2A9.7 9.7 0 0112 4c6.5 0 10 8 10 8a18 18 0 01-2.2 3.2M1 1l22 22')],
  translate: [p('M4 5h9M9 3v2M6 5c0 4 3 7 7 8M12 5c0 4-3 7-7 8M13 21l4-10 4 10M14.5 18h5')],
};

/** Direction icons that point the way the layout reads; they flip in right-to-left layouts. Media (play/pause) and literal-direction icons never flip. */
const MIRROR_IN_RTL = new Set<IconName>(['arrowLeft', 'arrowRight', 'chevronLeft', 'chevronRight', 'reply', 'forward', 'send', 'sendFeather', 'logout']);

export interface IconProps {
  name: IconName;
  /** Override the default RTL flip (false keeps a literal direction, e.g. a physical swipe hint). */
  mirror?: boolean;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const Icon = ({ name, size = 24, color = '#626B84', strokeWidth = 2, mirror }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={I18nManager.isRTL && (mirror ?? MIRROR_IN_RTL.has(name)) ? { transform: [{ scaleX: -1 }] } : undefined}>
    {ICONS[name].map((n, i) => {
      if (n.t === 'c') {
        return <Circle key={i} cx={n.cx} cy={n.cy} r={n.r} stroke={color} strokeWidth={strokeWidth} fill={n.fill ? color : 'none'} />;
      }
      if (n.t === 'r') {
        return <Rect key={i} x={n.x} y={n.y} width={n.w} height={n.h} rx={n.rx} stroke={color} strokeWidth={strokeWidth} />;
      }
      return (
        <Path
          key={i}
          d={n.d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={n.fill ? color : 'none'}
        />
      );
    })}
  </Svg>
);

export default Icon;
