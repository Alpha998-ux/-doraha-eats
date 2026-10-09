import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, Pressable, Switch, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, AppText, Badge, Button, Card, LoadingBlock, EmptyState } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme/tokens';
import { getMyVendor, listVendorOrders, setVendorOpen, type VendorProfile } from '../../src/features/vendor/api';
import type { OrderDetail } from '../../src/features/orders/api';
import { useAuthStore } from '../../src/store/authStore';
import { formatPaise } from '../../src/lib/money';
import { ApiError } from '../../src/lib/api';

const ACTIVE_STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

export default function VendorDashboard() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyToggle, setBusyToggle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const [v, o] = await Promise.all([getMyVendor(), listVendorOrders()]);
      if (isMounted.current) {
        setVendor(v.vendor);
        setOrders(o.orders.filter((ord) => ACTIVE_STATUSES.includes(ord.status)));
        setError(null);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof ApiError ? e.message : 'Failed to load stall orders.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      load();
      const interval = setInterval(load, 6000);
      return () => {
        isMounted.current = false;
        clearInterval(interval);
      };
    }, [load])
  );

  async function toggleOpen() {
    if (!vendor || busyToggle) return;
    setBusyToggle(true);
    setError(null);
    try {
      const { vendor: v } = await setVendorOpen(!vendor.isOpenManual);
      if (isMounted.current) {
        setVendor(v);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof ApiError ? e.message : 'Could not change stall status.');
      }
    } finally {
      if (isMounted.current) {
        setBusyToggle(false);
      }
    }
  }

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <AppText variant="h1">{vendor?.name}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {vendor?.status === 'ACTIVE' ? 'Approved Stall' : vendor?.status}
            </AppText>
          </View>
          <Pressable onPress={logout}>
            <AppText variant="caption" color={colors.danger}>Log out</AppText>
          </Pressable>
        </View>

        <Card style={{ marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <AppText variant="bodyBold">Stall status</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {vendor?.isOpenManual ? 'Open for orders' : 'Closed'}
            </AppText>
          </View>
          <Switch
            value={vendor?.isOpenManual}
            onValueChange={toggleOpen}
            disabled={busyToggle}
            trackColor={{ true: colors.primary }}
          />
        </Card>

        {error && (
          <AppText variant="body" color={colors.danger} style={{ marginTop: spacing.md }}>
            {error}
          </AppText>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          <Button variant="secondary" onPress={() => router.push('/(vendor)/menu')} fullWidth={false}>
            Menu Management
          </Button>
          <Button variant="secondary" onPress={() => router.push('/(vendor)/earnings')} fullWidth={false}>
            Earnings
          </Button>
        </View>

        <AppText variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Active orders
        </AppText>

        {orders.length === 0 ? (
          <EmptyState title="No active orders" subtitle="New orders will appear here automatically." />
        ) : (
          orders.map((o) => (
            <Pressable key={o.id} onPress={() => router.push(`/(vendor)/order/${o.id}`)} style={styles.orderCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="bodyBold">{o.code}</AppText>
                <Badge label={o.statusLabel} tone={o.status === 'PLACED' ? 'yellow' : 'blue'} />
              </View>
              <AppText variant="caption" color={colors.textMuted}>
                {o.items.length} item(s) · {formatPaise(o.totalPaise)}
              </AppText>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
});
