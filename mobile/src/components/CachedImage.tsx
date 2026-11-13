import { Image, ImageProps, StyleSheet } from 'react-native';
import { useAppColors } from '../theme/useAppColors';

export const CachedImage = (props: ImageProps) => {
  const { c } = useAppColors();
  return (
    <Image
      {...props}
      style={[styles.container, { backgroundColor: c.surface }, props.style]}
      resizeMode={props.resizeMode || 'cover'}
      fadeDuration={300}
    />
  );
};

const styles = StyleSheet.create({ container: { overflow: 'hidden' } });
