import React, { useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppText, Button } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme/tokens';
import { verifyOtp, requestOtp } from '../../src/features/auth/api';
import { useAuthStore } from '../../src/store/authStore';
import { ApiError } from '../../src/lib/api';
import { t } from '../../src/lib/i18n';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  async function verify() {
    setError(null); setBusy(true);
    try {
      const { user, token } = await verifyOtp(phone, code.trim());
      await setSession(user, token);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not verify code.');
    } finally { setBusy(false); }
  }

  async function resend() {
    await requestOtp(phone);
    setResent(true);
    setTimeout(() => setResent(false), 3000);
  }

  return (
    <Screen style={{ justifyContent: 'center', padding: spacing.xl }}>
      <AppText variant="h2">{t('verifyOtp')}</AppText>
      <AppText variant="body" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>
        Enter the 6-digit code sent to {phone}
      </AppText>
      {error && <AppText variant="body" color={colors.danger} style={{ marginBottom: spacing.md }}>{error}</AppText>}
      <TextInput
        value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}
        style={styles.input} placeholder="123456" autoFocus
      />
      <Button onPress={verify} loading={busy} disabled={code.length < 4}>{t('verifyOtp')}</Button>
      <Button variant="ghost" onPress={resend}>{resent ? 'Code resent' : 'Resend code'}</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: spacing.md, backgroundColor: '#fff', fontSize: 22, letterSpacing: 8, textAlign: 'center',
  },
});
