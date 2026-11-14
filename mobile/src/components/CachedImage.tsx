import { Image, ImageProps, Platform, StyleSheet } from 'react-native';
import { useAppColors } from '../theme/useAppColors';

/**
 * Shared remote-image loader.
 * Adds the zrok bypass header (React Native Image does not use Axios interceptors)
 * and lets the native image pipeline cache and downsample images efficiently.
 */
export const CachedImage = (props: ImageProps) => {
  const { c } = useAppColors();
  const originalSource = props.source;
  const source =
    originalSource && typeof originalSource === 'object' && !Array.isArray(originalSource) && 'uri' in originalSource && originalSource.uri
      ? {
          ...originalSource,
          cache: originalSource.cache || 'default',
          headers: {
            ...originalSource.headers,
            skip_zrok_interstitial: '1',
          },
        }
      : originalSource;

  return (
    <Image
      {...props}
      source={source}
      style={[styles.container, { backgroundColor: c.surface }, props.style]}
      resizeMode={props.resizeMode || 'cover'}
      resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
      progressiveRenderingEnabled={Platform.OS === 'android'}
      fadeDuration={120}
    />
  );
};

const styles = StyleSheet.create({ container: { overflow: 'hidden' } });
