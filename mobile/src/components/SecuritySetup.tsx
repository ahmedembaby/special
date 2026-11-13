import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StatusBar, Modal, ActivityIndicator, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from './Icon';
import { useAppLock } from '../context/AppLockContext';
import * as lock from '../services/appLock';
import { PillButton } from './PillButton';

type Mode = 'face' | 'touch' | 'pin';
type Phase = 'idle' | 'scanning' | 'done';

const COPY: Record<Mode, { title: string; desc: string; hint?: string; key: string }> = {
  face: { title: 'Face Recognition', desc: 'Secure your account with your face\nusing Face Recognition', key: 'echat_faceid_enabled' },
  touch: {
    title: 'Fingerprint Security',
    desc: 'Secure your account with your fingerprint\nusing Fingerprint Security',
    hint: 'Please place your finger\non the fingerprint sensor to get started',
    key: 'echat_touchid_enabled',
  },
  pin: { title: 'PIN Security', desc: 'Protect your account with a secure PIN', key: 'echat_pin_enabled' },
};

const Brackets = ({ color, size = 300, thick = 4, len = 52 }: { color: string; size?: number; thick?: number; len?: number }) => {
  const base = { position: 'absolute' as const, width: len, height: len, borderColor: color };
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <View style={[base, { top: 0, left: 0, borderTopWidth: thick, borderLeftWidth: thick }]} />
      <View style={[base, { top: 0, right: 0, borderTopWidth: thick, borderRightWidth: thick }]} />
      <View style={[base, { bottom: 0, left: 0, borderBottomWidth: thick, borderLeftWidth: thick }]} />
      <View style={[base, { bottom: 0, right: 0, borderBottomWidth: thick, borderRightWidth: thick }]} />
    </View>
  );
};

export const SecuritySetup = ({ mode }: { mode: Mode }) => {
  const navigation = useNavigation() as any;
  const disable = !!(useRoute() as any).params?.disable;
  const insets = useSafeAreaInsets();
  const { c, isDark } = useAppColors();
  const copy = COPY[mode];

  const { settings, refresh } = useAppLock();
  const [phase, setPhase] = useState<Phase>('idle');
  const [pin, setPin] = useState('');
  // PIN flow: (current ->) new -> confirm
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>(settings.pinEnabled ? 'current' : 'new');
  const [firstPin, setFirstPin] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setStep(settings.pinEnabled ? 'current' : 'new'); }, [settings.pinEnabled]);
  const [dialog, setDialog] = useState(false);
  const pinRef = useRef<any>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  const startScan = async () => {
    if (phase === 'scanning') return;
    setMsg('');
    if (!settings.pinEnabled) {
      setMsg('Set a PIN first (PIN Security), then enable biometrics.');
      return;
    }
    if (!(await lock.biometricAvailable())) {
      setMsg('No biometrics are set up on this device. Add one in your phone settings first.');
      return;
    }
    setPhase('scanning');
    const ok = await lock.authenticateBiometric('Confirm to enable biometric unlock');
    setPhase(ok ? 'done' : 'idle');
    if (!ok) setMsg('Authentication failed. Try again.');
  };

  const ready = mode === 'pin' ? pin.length === 4 : phase === 'done';

  const finish = async () => {
    await refresh();
    setDialog(true);
    later(() => { setDialog(false); navigation.goBack(); }, 1500);
  };

  const next = async () => {
    if (!ready) return;
    try {
      if (mode === 'pin') {
        if (step === 'current') {
          if (await lock.verifyPin(pin)) {
            if (disable) { await lock.disableLock(); await refresh(); navigation.goBack(); return; }
            setStep('new'); setPin(''); setMsg('');
          } else { setPin(''); setMsg('Wrong PIN'); }
        } else if (step === 'new') {
          setFirstPin(pin); setPin(''); setStep('confirm'); setMsg('');
        } else if (pin !== firstPin) {
          setPin(''); setFirstPin(''); setStep('new'); setMsg('PINs did not match. Start again.');
        } else {
          await lock.setPin(pin);
          await finish();
        }
      } else {
        await lock.setBiometricEnabled(true);
        await finish();
      }
    } catch {
      setMsg('Could not save. Please try again.');
    }
  };

  const accent = phase === 'done' ? c.accentGreen : c.accentYellow;
  const idleGray = isDark ? '#4A4B62' : '#EFEFF0';

  return (
    <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.top}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={[styles.back, { backgroundColor: c.background }]}
        >
          <Icon name="arrowLeft" size={22} color={c.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>{copy.title}</Text>
        <View style={styles.back} />
      </View>
      <Text style={[styles.desc, { color: c.textSecondary }]}>
        {mode === 'pin'
          ? step === 'current' ? (disable ? 'Enter your PIN to turn off App Lock' : 'Enter your current PIN') : step === 'new' ? 'Choose a 4-digit PIN to lock the app' : 'Enter the PIN again to confirm'
          : copy.desc}
      </Text>
      {msg ? <Text style={{ color: c.danger, textAlign: 'center', marginTop: 10 }}>{msg}</Text> : null}

      <View style={styles.center}>
        {mode === 'pin' ? (
          <TouchableOpacity activeOpacity={1} onPress={() => pinRef.current?.focus()} style={styles.pinRow}>
            {[0, 1, 2, 3].map((i) => {
              const active = i === Math.min(pin.length, 3);
              return (
                <View key={i} style={[styles.pinBox, { borderBottomColor: active ? c.primary : c.textSecondary }]}>
                  <Text style={[styles.pinDigit, { color: c.text }]}>{pin[i] || ''}</Text>
                </View>
              );
            })}
            <TextInput
              ref={pinRef}
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              caretHidden
              style={styles.hidden}
            />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity activeOpacity={0.9} onPress={startScan} style={styles.scanArea}>
              <View style={StyleSheet.absoluteFill as any}>
                <Brackets color={accent} />
              </View>
              {phase === 'scanning' ? (
                <LinearGradient
                  colors={['rgba(29,161,242,0.55)', 'rgba(29,161,242,0)']}
                  style={styles.sweep}
                />
              ) : null}
              <Icon
                name={mode === 'face' ? 'face' : 'fingerprint'}
                size={170}
                color={phase === 'done' ? c.accentGreen : idleGray}
                strokeWidth={phase === 'done' ? 1.2 : 1}
              />
            </TouchableOpacity>
            {phase === 'done' ? (
              <View style={styles.okRow}>
                <Icon name="check" size={18} color={c.accentGreen} />
                <Text style={[styles.okText, { color: c.accentGreen }]}>Authentication successful</Text>
              </View>
            ) : mode === 'touch' ? (
              <Text style={[styles.hint, { color: c.textSecondary }]}>{copy.hint}</Text>
            ) : (
              <Text style={[styles.hint, { color: c.textMuted }]}>Tap the frame to verify and enable</Text>
            )}
          </>
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + (mode === 'pin' ? 8 : 12) }]}>
        <PillButton title="Skip" variant="secondary" onPress={() => navigation.goBack()} />
        <PillButton title={mode === 'pin' && step !== 'confirm' ? 'Next' : 'Continue'} disabled={!ready} onPress={next} />
      </View>

      <Modal visible={dialog} transparent animationType="fade" onRequestClose={() => setDialog(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: c.background }]}>
            <TouchableOpacity style={styles.close} onPress={() => { setDialog(false); navigation.goBack(); }}>
              <Icon name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
            <Text style={[styles.cTitle, { color: c.text }]}>Security enabled</Text>
            <View style={styles.badge}>
              <Icon name="check" size={44} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <Text style={[styles.cBold, { color: c.text }]}>{mode === 'pin' ? 'Your PIN is set.' : 'Biometric unlock is on.'}</Text>
            <Text style={[styles.cSub, { color: c.textSecondary }]}>You will be taken back{'\n'}in a moment.</Text>
            <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 22 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F4F2FB',
  },
  title: { fontSize: 18, fontWeight: '600' },
  desc: { fontSize: 14, textAlign: 'center', marginTop: 26, lineHeight: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanArea: { width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  sweep: { position: 'absolute', top: 70, left: 4, right: 4, height: 150 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28 },
  okText: { fontSize: 14, fontWeight: '500' },
  hint: { fontSize: 14, textAlign: 'center', marginTop: 28, lineHeight: 20 },
  pinRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignSelf: 'flex-start', marginTop: -140 },
  pinBox: { width: 62, height: 58, borderBottomWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pinDigit: { fontSize: 36, fontWeight: '500' },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  bottom: { flexDirection: 'row', gap: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', borderRadius: 24, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center' },
  close: { position: 'absolute', top: 16, right: 16 },
  cTitle: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  badge: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#6C4DF6', alignItems: 'center', justifyContent: 'center', marginVertical: 26 },
  cBold: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  cSub: { fontSize: 15, textAlign: 'center', marginTop: 6, lineHeight: 21 },
});

export default SecuritySetup;
