import React, { useState } from 'react';
import { View, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, Button } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme/tokens';
import { requestOtp, login } from '../../src/features/auth/api';
import { ApiError } from '../../src/lib/api';
import { t } from '../../src/lib/i18n';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'phone' | 'password'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    setError(null);
    if (phone.trim().length < 10) { setError('Please enter a valid 10-digit phone number.'); return; }
    setBusy(true);
    try {
      const fullPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
      await requestOtp(fullPhone);
      router.push({ pathname: '/(onboarding)/otp', params: { phone: fullPhone } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  async function passwordLogin() {
    setError(null); setBusy(true);
    try {
      const { user, token } = await login(email.trim(), password);
      const { useAuthStore } = await import('../../src/store/authStore');
      await useAuthStore.getState().setSession(user, token);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Incorrect email or password.');
    } finally { setBusy(false); }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
        <AppText variant="h1" color={colors.primary}>Doraha Eats</AppText>
        <AppText variant="body" color={colors.textMuted} style={{ marginBottom: spacing.xl }}>Doraha da apna food delivery.</AppText>

        {error && <AppText variant="body" color={colors.danger} style={{ marginBottom: spacing.md }}>{error}</AppText>}

        {mode === 'phone' ? (
          <>
            <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>{t('enterPhone')}</AppText>
            <TextInput
              value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210"
              style={styles.input} maxLength={13}
            />
            <Button onPress={sendOtp} loading={busy}>Send OTP</Button>
            <Button variant="ghost" onPress={() => setMode('password')}>Log in as vendor / delivery / admin instead</Button>
          </>
        ) : (
          <>
            <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>Email</AppText>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
            <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>Password</AppText>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
            <Button onPress={passwordLogin} loading={busy}>{t('logIn')}</Button>
            <Button variant="ghost" onPress={() => setMode('phone')}>Log in as customer with phone instead</Button>
          </>
        )}

        <View style={{ marginTop: spacing.xl, padding: spacing.md, backgroundColor: '#F1EAE0', borderRadius: 12 }}>
          <AppText variant="caption" color={colors.textMuted}>
            Demo accounts (password Doraha@123): vendor@dorahaeats.local · delivery@dorahaeats.local · admin@dorahaeats.local.
            Customer OTP prints to the server console in development.
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: spacing.md, backgroundColor: '#fff', fontSize: 15,
  },
});
