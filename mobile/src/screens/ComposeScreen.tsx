import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppColors } from '../theme/useAppColors';
import { useMe } from '../hooks/useMe';
import * as social from '../services/social';
import { ScreenHeader } from '../components/ScreenHeader';
import { PostComposer } from '../components/PostComposer';

export default function ComposeScreen() {
  const nav = useNavigation() as any;
  const { c } = useAppColors();
  const me = useMe();
  const route = useRoute() as any;
  const quote: social.Post | undefined = route.params?.quote;
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader title={quote ? 'Quote post' : 'New post'} onBack={() => nav.goBack()} />
      <PostComposer
        me={me}
        autoFocus
        quote={quote}
        onPost={async (text, img, extras) => {
          await social.createPost(me, text, img, { ...extras, repostOf: quote?.id });
          nav.goBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
