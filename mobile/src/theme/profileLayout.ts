import { I18nManager } from 'react-native';

/** Shared sizes for the three profile screens (own profile, other user, edit) so they line up. */
export const PROFILE = {
  bannerHeight: 168,
  padX: 20,
  padBottom: 20,
  avatar: 80,
  avatarOverlap: -44,
  avatarRowGap: 10,
  nameSize: 26,
  actionHeight: 40,
  actionRadius: 14,
  countsGap: 18,
  sectionGap: 10,
} as const;

/** Explicit start alignment for text blocks: Latin text inside an RTL layout otherwise aligns to the physical left. Direction of the glyphs stays automatic so @handles and punctuation do not reorder. */
export const startText = () => ({ textAlign: (I18nManager.isRTL ? 'right' : 'left') as 'left' | 'right' });
