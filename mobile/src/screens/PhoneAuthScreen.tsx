import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StatusBar,
  Modal, FlatList, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as api from '../services/api';
import { COUNTRIES, Country } from '../constants/countries';
import { useAppColors } from '../theme/useAppColors';
import { AuthHeader } from '../components/AuthHeader';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { Icon } from '../components/Icon';

/** Phone-number step for Login - auto-registers new users on server */
export default function PhoneAuthScreen() {
  const navigation = useNavigation() as any;
  const { c, isDark } = useAppColors();
  const [country, setCountry] = useState<Country>(COUNTRIES[1]);
  const [phone, setPhone] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(false);

  const digits = phone.replace(/\D/g, '');
  const valid = digits.length >= 7;
  const formatted = digits.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, (_m, a, b, d) => [a, b, d].filter(Boolean).join(' '));

  const submit = async () => {
    if (!valid) return;
    // national numbers are often typed with a leading trunk 0 (e.g. 010...): the international form has none
    const full = `${country.code}${digits.replace(/^0+/, '')}`;
    setLoading(true);
    try {
      const res = await api.auth.sendOTP({ phone: full });
      // Development servers (OTP_DEV_MODE) return the code when WhatsApp is not linked
      if (res.data?.devCode) Alert.alert('Development code', `Your verification code is ${res.data.devCode}`);
      navigation.navigate('OTP', { phone: full, display: `(${country.code}) ${formatted}`, mode: 'login', remember });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not send the code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AuthHeader
        title="Login"
        subtitle="Enter your\nmobile phone"
        backLabel="Back"
        onBack={() => navigation.goBack()}
        variant="curve"
      />

      <View style={styles.body}>
        <Text style={[styles.info, { color: c.textSecondary }]}>You will get a code via sms.</Text>

        <View style={[styles.phoneRow, { borderBottomColor: c.text }]}>
          <TouchableOpacity style={styles.flagBtn} onPress={() => setPicker(true)} activeOpacity={0.7}>
            <Text style={styles.flag}>{country.flag}</Text>
            <Icon name="chevronDown" size={18} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.code, { color: c.textMuted }]}>({country.code})</Text>
          <TextInput
            value={formatted}
            onChangeText={setPhone}
            placeholder="00 0000 0000"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            style={[styles.input, { color: c.text }]}
            maxLength={13}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.remember} onPress={() => setRemember((v) => !v)} activeOpacity={0.8}>
            <View style={[styles.checkbox, { borderColor: c.text }, remember && { backgroundColor: c.primary, borderColor: c.primary }]}>
              {remember ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={2.4} /> : null}
            </View>
            <Text style={[styles.rememberText, { color: c.text }]}>Remember me</Text>
          </TouchableOpacity>
          <RoundArrowButton onPress={submit} disabled={!valid} loading={loading} />
        </View>
      </View>

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPicker(false)}>
          <View style={[styles.sheet, { backgroundColor: c.background }]}>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(i) => i.code + i.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => { setCountry(item); setPicker(false); }}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={[styles.countryName, { color: c.text }]}>{item.name}</Text>
                  <Text style={{ color: c.textMuted }}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingHorizontal: 24, marginTop: 38 },
  info: { fontSize: 16, textAlign: 'center', marginBottom: 28 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, paddingBottom: 8 },
  flagBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 14 },
  flag: { fontSize: 26 },
  code: { fontSize: 20, marginRight: 10 },
  input: { flex: 1, fontSize: 20, padding: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rememberText: { fontSize: 14, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 32 },
  sheet: { borderRadius: 16, maxHeight: 420, paddingVertical: 8 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  countryName: { flex: 1, fontSize: 16 },
});
