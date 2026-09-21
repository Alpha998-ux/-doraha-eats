import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, AppText, Badge, LoadingBlock, EmptyState } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/theme/tokens';
import { listMyOrders, type OrderDetail } from '../../../src/features/orders/api';
import { formatPaise } from '../../../src/lib/money';

const toneFor = (s: string): 'green' | 'red' | 'yellow' => (s === 'DELIVERED' ? 'green' : s === 'CANCELLED' ? 'red' : 'yellow');

export default function OrdersTab() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    listMyOrders().then((r) => setOrders(r.orders)).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen style={{ padding: spacing.lg }}>
      <AppText variant="h1" style={{ marginBottom: spacing.md }}>Your orders</AppText>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListEmptyComponent={<EmptyState title="No orders yet" subtitle="Your past orders will show up here." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(customer)/orders/${item.id}`)} style={styles.card}>
            <AppText variant="bodyBold">{item.vendor.name}</AppText>
            <AppText variant="caption" color={colors.textMuted}>{item.code} · {new Date(item.placedAt).toLocaleDateString('en-IN')}</AppText>
            <AppText variant="price" style={{ marginTop: 4 }}>{formatPaise(item.totalPaise)}</AppText>
            <Badge label={item.statusLabel} tone={toneFor(item.status)} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, gap: 4 },
});
