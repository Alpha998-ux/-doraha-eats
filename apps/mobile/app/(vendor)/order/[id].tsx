import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppText, Button, Card, Divider, LoadingBlock, Badge } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/theme/tokens';
import { acceptOrder, rejectOrder, markPreparing, markReady } from '../../../src/features/vendor/api';
import { getOrder, type OrderDetail } from '../../../src/features/orders/api';
import { formatPaise } from '../../../src/lib/money';
import { ApiError } from '../../../src/lib/api';
import { t } from '../../../src/lib/i18n';

export default function VendorOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const load = useCallback(() => { getOrder(id).then(({ order }) => setOrder(order)); }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(fn: () => Promise<{ order: OrderDetail }>) {
    setBusy(true); setError(null);
    try { const { order } = await fn(); setOrder(order); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Action failed.'); }
    finally { setBusy(false); }
  }

  if (!order) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="h2">{order.code}</AppText>
          <Badge label={order.statusLabel} tone="blue" />
        </View>
        <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>
          {order.paymentMethod} · {order.contactPhone}
        </AppText>

        <Card style={{ marginBottom: spacing.lg }}>
          {order.items.map((it) => (
            <View key={it.id} style={{ marginBottom: spacing.sm }}>
              <AppText variant="bodyBold">{it.quantity} × {it.nameSnapshot}</AppText>
              {it.options.map((o, i) => <AppText key={i} variant="caption" color={colors.textMuted}>  {o.nameSnapshot}</AppText>)}
            </View>
          ))}
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <AppText variant="bodyBold">Total</AppText>
            <AppText variant="bodyBold">{formatPaise(order.totalPaise)}</AppText>
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <AppText variant="bodyBold">Deliver to</AppText>
          <AppText variant="body">{order.addressLine}, {order.addressArea}</AppText>
          {order.cookingNote && <AppText variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>Note: {order.cookingNote}</AppText>}
        </Card>

        {error && <AppText variant="body" color={colors.danger} style={{ marginBottom: spacing.md }}>{error}</AppText>}

        {order.status === 'PLACED' && !showReject && (
          <View style={{ gap: spacing.sm }}>
            <Button onPress={() => act(() => acceptOrder(order.id, 20))} loading={busy}>{t('acceptOrder')}</Button>
            <Button variant="danger" onPress={() => setShowReject(true)}>{t('rejectOrder')}</Button>
          </View>
        )}
        {showReject && (
          <View style={{ gap: spacing.sm }}>
            <TextInput value={rejectReason} onChangeText={setRejectReason} placeholder="Reason for rejecting" style={styles.input} />
            <Button variant="danger" onPress={() => act(() => rejectOrder(order.id, rejectReason || 'Unable to fulfil'))} loading={busy}>Confirm reject</Button>
          </View>
        )}
        {order.status === 'ACCEPTED' && <Button onPress={() => act(() => markPreparing(order.id))} loading={busy}>{t('markPreparing')}</Button>}
        {order.status === 'PREPARING' && <Button onPress={() => act(() => markReady(order.id))} loading={busy}>{t('markReady')}</Button>}
        {['READY', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(order.status) && (
          <AppText variant="body" color={colors.textMuted}>Waiting for the delivery partner to complete this order.</AppText>
        )}
        {order.status === 'DELIVERED' && <Badge label="Delivered" tone="green" />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: '#fff' },
});
