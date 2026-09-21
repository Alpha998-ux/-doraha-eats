import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, Linking, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppText, Button, Card, LoadingBlock, Badge } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/theme/tokens';
import { getDeliveryOrder, setDeliveryStatus } from '../../../src/features/rider/api';
import type { OrderDetail } from '../../../src/features/orders/api';
import { formatPaise } from '../../../src/lib/money';
import { ApiError } from '../../../src/lib/api';
import { t } from '../../../src/lib/i18n';

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [nav, setNav] = useState<{ pickup: string; drop: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collected, setCollected] = useState('');

  const load = useCallback(() => {
    getDeliveryOrder(id).then(({ order, navigation }) => { setOrder(order); setNav(navigation); });
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function updateStatus(status: 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED') {
    setBusy(true); setError(null);
    try {
      const codPaise = status === 'DELIVERED' && order?.paymentMethod === 'COD'
        ? Math.round(parseFloat(collected || '0') * 100) : undefined;
      const { order: o } = await setDeliveryStatus(id, status, codPaise);
      setOrder(o);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not update status.'); }
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

        <Card style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
          <AppText variant="bodyBold">Pickup</AppText>
          <AppText variant="body">{order.vendor.name}</AppText>
          {nav && <Button variant="secondary" onPress={() => Linking.openURL(nav.pickup)}>Navigate to stall</Button>}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <AppText variant="bodyBold">Drop-off</AppText>
          <AppText variant="body">{order.addressLine}, {order.addressArea}</AppText>
          <AppText variant="caption" color={colors.textMuted}>Contact: {order.contactPhone}</AppText>
          {nav && <Button variant="secondary" onPress={() => Linking.openURL(nav.drop)}>Navigate to customer</Button>}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <AppText variant="body">Order total</AppText>
          <AppText variant="h3">{formatPaise(order.totalPaise)}</AppText>
          <AppText variant="caption" color={colors.textMuted}>{order.paymentMethod}</AppText>
        </Card>

        {error && <AppText variant="body" color={colors.danger} style={{ marginBottom: spacing.md }}>{error}</AppText>}

        {order.status === 'ASSIGNED' && <Button onPress={() => updateStatus('PICKED_UP')} loading={busy}>{t('pickedUp')}</Button>}
        {order.status === 'PICKED_UP' && <Button onPress={() => updateStatus('ON_THE_WAY')} loading={busy}>{t('onTheWay')}</Button>}
        {order.status === 'ON_THE_WAY' && (
          <View style={{ gap: spacing.sm }}>
            {order.paymentMethod === 'COD' && (
              <TextInput
                value={collected} onChangeText={setCollected} keyboardType="decimal-pad"
                placeholder={`Amount collected (Rs ${(order.totalPaise / 100).toFixed(2)})`}
                style={styles.input}
              />
            )}
            <Button onPress={() => updateStatus('DELIVERED')} loading={busy}>{t('markDelivered')}</Button>
          </View>
        )}
        {order.status === 'DELIVERED' && <Badge label="Delivered" tone="green" />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: '#fff' },
});
