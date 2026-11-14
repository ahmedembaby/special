import React from 'react';
import { View, Text, TouchableOpacity, StatusBar, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from '../components/Icon';

export default function WelcomeScreen() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.logo}>
        <Icon name="bubble" size={44} color={c.primary} strokeWidth={2.2} />
      </View>
      <View style={styles.middle}>
        <Text style={[styles.headline, { color: c.text }]}>See what's happening in the world right now.</Text>
        <Text style={[styles.tagline, { color: c.textSecondary }]}>Post, follow and chat with friends and family.</Text>
      </View>
      <View>
        <TouchableOpacity style={[styles.btn, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
          <Text style={styles.btnText}>Continue with phone</Text>
        </TouchableOpacity>
        <Text style={[styles.legal, { color: c.textSecondary }]}>
          By continuing, you agree to the Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 30, justifyContent: 'space-between' },
  logo: { alignItems: 'center', justifyContent: 'center', width: 84, height: 84, borderRadius: 28, alignSelf: 'center', backgroundColor: 'rgba(91,92,226,0.09)' },
  middle: { gap: 12 },
  headline: { fontSize: 36, fontWeight: '800', lineHeight: 43, letterSpacing: -0.9 },
  tagline: { fontSize: 17, lineHeight: 24 },
  btn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  legal: { fontSize: 13, lineHeight: 18, marginTop: 14 },
});
