import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, TextInput, Linking, Pressable, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppText, Button, Card, Divider, LoadingBlock, ErrorState } from '../../../src/components/ui';
import { OrderStatusStepper } from '../../../src/components/OrderStatusStepper';
import { colors, radius, spacing } from '../../../src/theme/tokens';
import { getOrder, cancelOrder, submitUpiRef, submitReview, type OrderDetail } from '../../../src/features/orders/api';
import { formatPaise } from '../../../src/lib/money';
import { ApiError } from '../../../src/lib/api';
import { t } from '../../../src/lib/i18n';

const POLL_MS = 5000;
const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    getOrder(id)
      .then(({ order: updatedOrder }) => {
        setOrder(updatedOrder);
        // Auto-clear polling interval if order is in terminal state
        if (TERMINAL_STATUSES.includes(updatedOrder.status) && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load order.'));
  }, [id]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  if (error && !order) return <Screen><ErrorState message={error} onRetry={load} /></Screen>;
  if (!order) return <Screen><LoadingBlock /></Screen>;

  const canCancel = order.status === 'PLACED';
  const needsUpi = order.paymentMethod === 'UPI' && order.paymentStatus !== 'PAID';
  const cleanUtr = utr.trim();
  const isValidUtr = /^\d{12}$/.test(cleanUtr);

  async function handleOpenUpiApp(uri: string) {
    try {
      const supported = await Linking.canOpenURL(uri);
      if (supported) {
        await Linking.openURL(uri);
      } else {
        Alert.alert('No UPI App Found', 'Please open GPay, PhonePe, or Paytm manually to complete payment.');
      }
    } catch {
      Alert.alert('Error', 'Unable to launch UPI application.');
    }
  }

  async function doCancel() {
    setBusy(true);
    setError(null);
    try {
      const { order: o } = await cancelOrder(id);
      setOrder(o);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not cancel order.');
    } finally {
      setBusy(false);
    }
  }

  async function submitUtr() {
    if (!isValidUtr) {
      setError('Please enter a valid 12-digit UTR reference number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { order: o } = await submitUpiRef(id, cleanUtr);
      setOrder(o);
      setUtr('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not verify payment UTR.');
    } finally {
      setBusy(false);
    }
  }

  async function rate() {
    if (!rating) return;
    setBusy(true);
    setError(null);
    try {
      await submitReview(id, { rating });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit review.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <AppText variant="h2">{order.vendor.name}</AppText>
        <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>{order.code}</AppText>

        <Card style={{ marginBottom: spacing.lg }}>
          <OrderStatusStepper status={order.status} events={order.events} />
        </Card>

        {order.deliveryPartner && (
          <Card style={{ marginBottom: spacing.lg }}>
            <AppText variant="h3">Delivery partner</AppText>
            <AppText variant="body">{order.deliveryPartner.name}</AppText>
            {order.deliveryPartner.phone && (
              <Pressable onPress={() => Linking.openURL(`tel:${order.deliveryPartner!.phone}`)}>
                <AppText variant="bodyBold" color={colors.primary}>Call {order.deliveryPartner.phone}</AppText>
              </Pressable>
            )}
          </Card>
        )}

        {needsUpi && order.payment?.raw?.upiUri && (
          <Card style={{ marginBottom: spacing.lg }}>
            <AppText variant="h3">Complete UPI payment</AppText>
            <AppText variant="body" color={colors.textMuted} style={{ marginVertical: spacing.sm }}>
              {order.payment.raw.instructions ?? 'Pay via any UPI app and enter the 12-digit UTR number below.'}
            </AppText>
            <Button variant="secondary" onPress={() => handleOpenUpiApp(order.payment!.raw!.upiUri!)}>
              Open UPI app
            </Button>
            <TextInput
              value={utr}
              onChangeText={(val) => {
                setUtr(val);
                if (error) setError(null);
              }}
              placeholder="Enter 12-digit UTR (e.g. 123456789012)"
              keyboardType="numeric"
              maxLength={12}
              style={styles.input}
            />
            <Button onPress={submitUtr} loading={busy} disabled={!isValidUtr || busy}>
              Confirm payment
            </Button>
          </Card>
        )}

        {error && (
          <AppText variant="caption" color={colors.danger} style={{ marginBottom: spacing.md }}>
            {error}
          </AppText>
        )}

        <Card style={{ marginBottom: spacing.lg }}>
          <AppText variant="h3" style={{ marginBottom: spacing.sm }}>Order summary</AppText>
          {order.items.map((it) => (
            <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <AppText variant="body">{it.quantity} × {it.nameSnapshot}</AppText>
              <AppText variant="body">{formatPaise(it.unitPricePaise * it.quantity)}</AppText>
            </View>
          ))}
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <AppText variant="bodyBold">Total</AppText>
            <AppText variant="bodyBold">{formatPaise(order.totalPaise)}</AppText>
          </View>
          <AppText variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
            {order.addressLine}, {order.addressArea}
          </AppText>
        </Card>

        {canCancel && (
          <Button variant="danger" onPress={doCancel} loading={busy}>{t('cancelOrder')}</Button>
        )}

        {order.status === 'DELIVERED' && !order.review && (
          <Card style={{ marginTop: spacing.lg }}>
            <AppText variant="h3" style={{ marginBottom: spacing.sm }}>{t('rateOrder')}</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)}>
                  <AppText variant="h1" color={n <= rating ? colors.accent : colors.border}>★</AppText>
                </Pressable>
              ))}
            </View>
            <Button onPress={rate} loading={busy} disabled={!rating || busy}>Submit review</Button>
          </Card>
        )}
        {order.review && (
          <Card style={{ marginTop: spacing.lg }}>
            <AppText variant="body">You rated this order {order.review.rating} ★</AppText>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginVertical: spacing.sm,
    backgroundColor: '#FFF',
  },
});
