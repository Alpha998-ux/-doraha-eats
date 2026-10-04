import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, Button, Divider, LoadingBlock, Badge } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/theme/tokens';
import { listAddresses, placeOrder, type Address } from '../../../src/features/orders/api';
import { quoteCart, type Quote } from '../../../src/features/cart/api';
import { formatPaise } from '../../../src/lib/money';
import { ApiError } from '../../../src/lib/api';
import { t } from '../../../src/lib/i18n';

export default function CheckoutScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [method, setMethod] = useState<'COD' | 'UPI'>('COD');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    listAddresses()
      .then(({ addresses }) => {
        if (!isMounted.current) return;
        setAddresses(addresses);
        // Default to primary valid address (in-zone only)
        const primary = addresses.find((a) => a.isDefault && a.zoneId) ?? addresses.find((a) => a.zoneId);
        if (primary) setSelectedId(primary.id);
      })
      .catch((e) => {
        if (!isMounted.current) return;
        setError(e instanceof ApiError ? e.message : 'Failed to load delivery addresses.');
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setError(null);

    quoteCart(selectedId)
      .then((res) => {
        if (isMounted.current) setQuote(res);
      })
      .catch((e) => {
        if (isMounted.current) {
          setQuote(null);
          setError(e instanceof ApiError ? e.message : 'Could not load pricing details.');
        }
      });
  }, [selectedId]);

  const selectedAddr = addresses.find((a) => a.id === selectedId);
  const b = quote?.breakdown;
  const blocked = quote && !quote.canPlaceOrder;

  async function submit() {
    if (!selectedId || placing || blocked || (selectedAddr && !selectedAddr.zoneId)) return;
    setPlacing(true);
    setError(null);

    try {
      const { order } = await placeOrder({ addressId: selectedId, paymentMethod: method });

      if (method === 'UPI' && order.paymentUrl) {
        router.replace(`/(customer)/orders/${order.id}/pay?url=${encodeURIComponent(order.paymentUrl)}`);
        return;
      }

      router.replace(`/(customer)/orders/${order.id}`);
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof ApiError ? e.message : 'Could not place order. Please try again.');
        setPlacing(false);
      }
    }
  }

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <AppText variant="h3" style={{ marginBottom: spacing.sm }}>Delivery address</AppText>

        {addresses.length === 0 ? (
          <AppText variant="body" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
            No addresses found. Please add a delivery location.
          </AppText>
        ) : (
          addresses.map((a) => {
            const isOutOfZone = !a.zoneId;
            return (
              <Pressable
                key={a.id}
                disabled={isOutOfZone}
                onPress={() => setSelectedId(a.id)}
                style={[
                  styles.addrCard,
                  selectedId === a.id && styles.addrSelected,
                  isOutOfZone && styles.disabledCard,
                ]}
              >
                <View style={styles.cardHeader}>
                  <AppText variant="bodyBold">{a.label}</AppText>
                  {isOutOfZone && <Badge label="Out of zone" tone="red" />}
                </View>
                <AppText variant="caption" color={colors.textMuted}>
                  {a.line1}, {a.area}
                </AppText>
              </Pressable>
            );
          })
        )}

        <Button variant="secondary" onPress={() => router.push('/(customer)/profile/add-address')}>
          + Add new address
        </Button>

        <AppText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Payment method
        </AppText>

        <Pressable 
          onPress={() => setMethod('COD')} 
          style={[styles.payOption, method === 'COD' && styles.addrSelected]}
        >
          <AppText variant="bodyBold">{t('cashOnDelivery')}</AppText>
        </Pressable>

        <Pressable 
          onPress={() => setMethod('UPI')} 
          style={[styles.payOption, method === 'UPI' && styles.addrSelected]}
        >
          <AppText variant="bodyBold">{t('payWithUpi')}</AppText>
        </Pressable>

        {error && (
          <AppText variant="body" color={colors.danger} style={{ marginTop: spacing.md }}>
            {error}
          </AppText>
        )}

        {blocked && quote?.blockers.map((bl) => (
          <AppText key={bl.code} variant="body" color={colors.danger} style={{ marginTop: spacing.sm }}>
            {bl.message}
          </AppText>
        ))}

        {b && (
          <View style={{ marginTop: spacing.xl }}>
            <AppText variant="h3" style={{ marginBottom: spacing.sm }}>Order summary</AppText>
            <SummaryRow label="Subtotal" value={b.subtotalPaise} />
            <SummaryRow label="Delivery fee" value={b.deliveryFeePaise} />
            <SummaryRow label="Platform fee" value={b.platformFeePaise} />
            <SummaryRow label="Tax" value={b.taxPaise} />
            {b.discountPaise > 0 && <SummaryRow label="Discount" value={-b.discountPaise} />}
            <Divider />
            <SummaryRow label="Total" value={b.totalPaise} bold />
            <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
              Estimated delivery in {b.etaMinutes} minutes
            </AppText>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          onPress={submit} 
          loading={placing} 
          disabled={!quote || blocked || !selectedId || placing || (selectedAddr && !selectedAddr.zoneId)}
        >
          {t('placeOrder')}{b ? ` · ${formatPaise(b.totalPaise)}` : ''}
        </Button>
      </View>
    </Screen>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <AppText variant={bold ? 'bodyBold' : 'body'}>{label}</AppText>
      <AppText variant={bold ? 'bodyBold' : 'body'}>{formatPaise(value)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  addrCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, backgroundColor: '#fff' },
  addrSelected: { borderColor: colors.primary, backgroundColor: '#FFF3EE' },
  disabledCard: { opacity: 0.5, backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  payOption: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, backgroundColor: '#fff' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
});
