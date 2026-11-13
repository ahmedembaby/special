import { Image, ImageProps, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export const CachedImage = (props: ImageProps) => {
  const { colors } = useTheme();

  return (
    <Image
      source={props.uri ? { uri: props.uri } : (props.source as any)}
      style={[
        styles.container,
        { backgroundColor: colors.surface },
        props.style,
      ]}
      resizeMode={props.resizeMode || 'cover'}
      fadeDuration={300}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
