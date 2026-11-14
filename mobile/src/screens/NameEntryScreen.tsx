import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StatusBar, StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAppColors } from '../theme/useAppColors';
import { AuthHeader } from '../components/AuthHeader';

/** Name entry screen for first-time users after OTP verification */
export default function NameEntryScreen() {
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { c, isDark } = useAppColors();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const registrationToken: string = route.params?.registrationToken || '';

  const submitName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.setName({ registrationToken, name: trimmed });
      await login(res.data.token, res.data.user);
    } catch (err: any) {
      if (err.response?.status === 401) {
        Alert.alert('Session expired', 'Please verify your phone number again.', [{ text: 'OK', onPress: () => navigation.popToTop() }]);
      } else {
        Alert.alert('Error', err.response?.data?.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AuthHeader
        title="Create Account"
        subtitle="Enter your name"
        backLabel="Back"
        onBack={() => navigation.goBack()}
        variant="curve"
      />

      <View style={styles.body}>
        <View style={[styles.field, { borderBottomColor: c.text }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your Name"
            accessibilityLabel="Your name"
            textContentType="name"
            placeholderTextColor={c.textSecondary}
            style={[styles.input, { color: c.text }]}
            autoCapitalize="words"
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: c.primary }, (!name.trim() || loading) && styles.btnDisabled]}
          onPress={submitName}
          disabled={!name.trim() || loading}
          accessibilityRole="button"
          accessibilityLabel="Create account and continue"
          accessibilityState={{ disabled: !name.trim() || loading, busy: loading }}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, { color: '#FFFFFF' }]}>{loading ? 'Creating...' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingHorizontal: 24, marginTop: 38 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 2, paddingBottom: 10 },
  input: { flex: 1, fontSize: 20, padding: 0 },
  btn: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.48,
  },
  btnText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
