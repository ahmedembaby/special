import React from 'react';
import { View, Text, TouchableOpacity, StatusBar, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';

export default function WelcomeScreen() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0D1222' : '#F7F8FF', paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0D1222' : '#F7F8FF'} />
      <View style={styles.topRow}>
        <View style={styles.brand}>
          <Image source={require('../../assets/logo.png')} style={styles.miniLogo} resizeMode="contain" />
          <Text style={[styles.brandName, { color: c.text }]}>special</Text>
        </View>
        <View style={[styles.onlinePill, { backgroundColor: isDark ? '#18253A' : '#EAF8F7' }]}>
          <View style={styles.onlineDot} />
          <Text style={[styles.onlineText, { color: isDark ? '#8DE5D0' : '#188D78' }]}>YOUR SPACE, CONNECTED</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
        <LinearGradient colors={['#F0E9FF', '#E7F5FF']} style={styles.logoHalo}>
          <Image source={require('../../assets/logo.png')} style={styles.heroLogo} resizeMode="contain" />
        </LinearGradient>
        <View style={styles.sparkleTop}><Text style={styles.sparkle}>✦</Text></View>
        <View style={styles.sparkleSide}><Text style={styles.sparkle}>✧</Text></View>
      </View>

      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: isDark ? '#A99BFF' : '#6D59D9' }]}>A LITTLE CLOSER, EVERY DAY</Text>
        <Text accessibilityRole="header" style={[styles.headline, { color: c.text }]}>Your people.{ '\n' }Your conversations.{ '\n' }Your <Text style={styles.headlineAccent}>space.</Text></Text>
        <Text style={[styles.tagline, { color: c.textSecondary }]}>Share moments, stay close, and keep every conversation in one place.</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue with phone" activeOpacity={0.88} onPress={() => navigation.navigate('Login')}>
          <LinearGradient colors={['#8A45F5', '#5545E8', '#246CEB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
            <Text style={styles.buttonText}>Continue with phone</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={[styles.legal, { color: c.textMuted }]}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
        <Text style={[styles.footer, { color: c.textMuted }]}>MADE FOR THE MOMENTS THAT MATTER</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between', overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  miniLogo: { width: 34, height: 34 },
  brandName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 30, paddingHorizontal: 11, paddingVertical: 8 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#25B99A' },
  onlineText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  hero: { height: 250, alignItems: 'center', justifyContent: 'center' },
  logoHalo: { width: 204, height: 204, borderRadius: 62, alignItems: 'center', justifyContent: 'center', shadowColor: '#6548E8', shadowOpacity: 0.18, shadowRadius: 32, shadowOffset: { width: 0, height: 16 }, elevation: 8 },
  heroLogo: { width: 174, height: 174 },
  glowOne: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(137,75,245,0.08)', transform: [{ translateX: -112 }, { translateY: -18 }] },
  glowTwo: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(30,174,239,0.09)', transform: [{ translateX: 120 }, { translateY: 35 }] },
  sparkleTop: { position: 'absolute', top: 18, right: '23%' },
  sparkleSide: { position: 'absolute', bottom: 22, left: '21%' },
  sparkle: { color: '#9A7BFF', fontSize: 28, fontWeight: '700' },
  copy: { gap: 13, marginBottom: 12 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 2.1 },
  headline: { fontSize: 35, lineHeight: 42, fontWeight: '900', letterSpacing: -1.5 },
  headlineAccent: { color: '#6B55E8' },
  tagline: { fontSize: 15, lineHeight: 24, maxWidth: 310 },
  actions: { gap: 14 },
  primaryButton: { minHeight: 60, borderRadius: 20, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#604AE7', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },
  buttonArrow: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', position: 'absolute', right: 22 },
  legal: { fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },
  footer: { fontSize: 8, letterSpacing: 2, fontWeight: '800', textAlign: 'center', marginTop: 3 },
});
