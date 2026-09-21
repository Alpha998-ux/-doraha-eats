import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, Card } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/theme/tokens';
import { useAuthStore } from '../../../src/store/authStore';

const ROWS = [
  { label: 'Addresses', icon: '📍', href: '/(customer)/profile/addresses' as const },
  { label: 'Notifications', icon: '🔔', href: null },
  { label: 'Language', icon: '🌐', href: null },
  { label: 'Help & Support', icon: '💬', href: null },
];

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  return (
    <Screen style={{ padding: spacing.lg }}>
      <AppText variant="h1" style={{ marginBottom: 4 }}>{user?.fullName}</AppText>
      <AppText variant="body" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>{user?.phone ?? user?.email}</AppText>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {ROWS.map((row, i) => (
          <Pressable
            key={row.label}
            onPress={() => row.href && router.push(row.href)}
            style={[styles.row, i < ROWS.length - 1 && styles.border]}
          >
            <AppText variant="body">{row.icon}  {row.label}</AppText>
            <AppText color={colors.textMuted}>›</AppText>
          </Pressable>
        ))}
      </Card>

      <Pressable onPress={logout} style={{ marginTop: spacing.xl }}>
        <AppText variant="bodyBold" color={colors.danger}>Log out</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
