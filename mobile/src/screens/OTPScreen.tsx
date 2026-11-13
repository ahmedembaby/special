import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StatusBar, StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAppColors } from '../theme/useAppColors';
import { AuthHeader } from '../components/AuthHeader';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { Icon } from '../components/Icon';

const LENGTH = 4;
const START = 45;

/** Design: "Sign Up/Login _ OTP Empty / Filled / Error / Resent Code". */
export default function OTPScreen() {
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { login } = useAuth();
  const { c, isDark } = useAppColors();
  const phone: string = route.params?.phone || '';
  const display: string = route.params?.display || phone;
  const mode: 'register' | 'login' = route.params?.mode || 'login';

  const [code, setCode] = useState('');
  const [timer, setTimer] = useState(START);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const resend = async () => {
    if (timer > 0) return;
    try {
      const res = await api.auth.resendOTP({ phone });
      if (res.data?.devCode) Alert.alert('Development code', `Your verification code is ${res.data.devCode}`);
      setTimer(START);
      setCode('');
      setError(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to resend code');
    }
  };

  const verify = async () => {
    if (code.length !== LENGTH) return;
    setLoading(true);
    try {
      const res = await api.auth.verifyOTP({ phone, code });
      const { token, user, userExists, registrationToken } = res.data || {};

      if (userExists && token) {
        // login() stores the session; the navigator switches to the main app by itself
        await login(token, user);
      } else if (registrationToken) {
        navigation.navigate('NameEntryScreen', { phone, registrationToken });
      } else {
        setError(true);
      }
    } catch (err: any) {
      setError(true);
      if (err.response?.status === 429) Alert.alert('Too many attempts', err.response?.data?.message || 'Request a new code.');
    } finally {
      setLoading(false);
    }
  };

  const mm = `00 : ${timer < 10 ? '0' : ''}${timer}`;
  const focusColor = c.primary;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AuthHeader
        title={mode === 'register' ? 'Register' : 'Login'}
        subtitle="Enter OTP Code"
        detail={`Sent to : ${display}`}
        backLabel={mode === 'register' ? 'Login' : 'Register'}
        onBack={() => navigation.goBack()}
        variant="flat"
      />

      <View style={styles.body}>
        <View style={styles.timerRow}>
          <Icon name="clock" size={18} color={c.text} />
          <Text style={[styles.timer, { color: c.text }]}>{mm}</Text>
          <TouchableOpacity onPress={resend} disabled={timer > 0}>
            <Text style={[styles.resend, { color: timer > 0 ? c.textMuted : c.primary }, timer === 0 && styles.resendActive]}>
              Resend Code
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.boxes}>
          {Array.from({ length: LENGTH }).map((_, i) => {
            const active = i === Math.min(code.length, LENGTH - 1) && !error;
            const line = error ? c.danger : active ? focusColor : c.text;
            return (
              <View key={i} style={[styles.box, { borderBottomColor: line }]}>
                <Text style={[styles.digit, { color: c.text }]}>{code[i] || ''}</Text>
              </View>
            );
          })}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, LENGTH)); setError(false); }}
            keyboardType="number-pad"
            maxLength={LENGTH}
            autoFocus
            style={styles.hidden}
            caretHidden
          />
        </TouchableOpacity>

        {error ? <Text style={[styles.error, { color: c.danger }]}>Code Invalid</Text> : <View style={{ height: 22 }} />}

        <View style={styles.btnWrap}>
          <RoundArrowButton onPress={verify} disabled={code.length !== LENGTH} loading={loading} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingHorizontal: 24, marginTop: 8 },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 },
  timer: { fontSize: 14, fontWeight: '500', marginRight: 6 },
  resend: { fontSize: 14, textDecorationLine: 'underline' },
  resendActive: { fontWeight: '700' },
  boxes: { flexDirection: 'row', justifyContent: 'space-between' },
  box: { width: 64, height: 56, borderBottomWidth: 2, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 32, fontWeight: '500' },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  error: { fontSize: 14, textAlign: 'center', marginTop: 14 },
  btnWrap: { alignItems: 'flex-end', marginTop: 4 },
});
