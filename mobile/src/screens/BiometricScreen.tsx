import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import * as LocalAuthentication from 'expo-local-authentication';

interface BiometricScreenProps {
  onSuccess: () => void;
  biometricType: LocalAuthentication.AuthenticationType | null;
  isAuthenticating: boolean;
  onError: () => void;
  onAuthenticate: () => Promise<boolean>;
}

export const BiometricScreen: React.FC<BiometricScreenProps> = ({
  onSuccess,
  biometricType,
  isAuthenticating,
  onError,
  onAuthenticate,
}) => {
  const { colors } = useTheme();

  const getLabel = () => {
    if (!biometricType) return 'Biometric Authentication';
    if (biometricType === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
      return 'Face ID';
    if (biometricType === LocalAuthentication.AuthenticationType.FINGERPRINT)
      return 'Touch ID';
    return 'Biometric Authentication';
  };

  const handlePress = async () => {
    const success = await onAuthenticate();
    if (success) {
      onSuccess();
    } else {
      onError();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {getLabel()}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Authenticate to continue to E-Chat
        </Text>
      </View>

      {isAuthenticating ? (
        <ActivityIndicator style={styles.spinner} size="large" color={colors.primary} />
      ) : (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handlePress}
        >
          <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
            Authenticate
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  spinner: {
    marginTop: 24,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
