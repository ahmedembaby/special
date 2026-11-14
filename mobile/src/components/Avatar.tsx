import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CachedImage } from './CachedImage';
import { useNavigation } from '@react-navigation/native';
import { resolveUrl } from '../config';
import { useAppColors } from '../theme/useAppColors';

interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: number;
  status?: string;
  onPress?: () => void;
  /** tapping the avatar opens this user's profile */
  userId?: string | number;
  style?: any;
}

export const Avatar = ({ source, name, size = 44, status, onPress: onPressProp, userId, style }: AvatarProps) => {
  const { c } = useAppColors();
  const nav = useNavigation() as any;
  const onPress = onPressProp || (userId != null ? () => nav.navigate('UserProfile', { userId: String(userId) }) : undefined);
  const uri = resolveUrl(source);
  const initial = (name || 'U').trim().charAt(0).toUpperCase() || 'U';
  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper {...wrapperProps} style={[{ width: size, height: size }, style]}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size * 0.34, backgroundColor: c.inputBg }]}>
        {uri ? (
          <CachedImage source={{ uri }} style={{ width: size, height: size }} />
        ) : (
          <View style={[styles.circle, { width: size, height: size, backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: size * 0.4 }}>{initial}</Text>
          </View>
        )}
      </View>
      {status ? (
        <View
          style={[
            styles.status,
            { borderColor: c.card, backgroundColor: status === 'online' ? c.success : c.textMuted },
          ]}
        />
      ) : null}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  circle: { overflow: 'hidden' },
  status: { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
});
