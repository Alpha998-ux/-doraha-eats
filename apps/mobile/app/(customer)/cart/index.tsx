import React, { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, Button, Divider, QuantityStepper, LoadingBlock, EmptyState, Badge } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/theme/tokens';
import { getCart, updateCartItem, removeCartItem } from '../../../src/features/cart/api';
import { useCartStore } from '../../../src/store/cartStore';
import { formatPaise } from '../../../src/lib/money';
import { ApiError } from '../../../src/lib/api';

export default function CartScreen() {
  const router = useRouter();
  const { cart, setCart } = useCartStore();
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getCart()
      .then(({ cart }) => {
        if (isMounted) setCart(cart);
      })
      .catch((e) => {
        if (isMounted) {
          Alert.alert('Error', e instanceof ApiError ? e.message : 'Could not load cart.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function changeQty(cartItemId: string, qty: number) {
    setBusyItemId(cartItemId);
    try {
      const { cart: updated } = qty <= 0 
        ? await removeCartItem(cartItemId) 
        : await updateCartItem(cartItemId, { quantity: qty });
      setCart(updated);
    } catch (e) {
      Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to update item quantity.');
    } finally {
      setBusyItemId(null);
    }
  }

  if (loading) return <Screen><LoadingBlock /></Screen>;

  if (!cart || cart.items.length === 0) {
    return (
      <Screen style={{ padding: spacing.lg }}>
        <EmptyState
          title="Your cart is empty"
          subtitle="Add something tasty from a nearby stall in Doraha."
          actionLabel="Explore Stalls"
          onAction={() => router.replace('/(customer)/(tabs)/explore')}
        />
      </Screen>
    );
  }

  const hasUnavailableItems = cart.items.some((item) => !item.isAvailable);
  const isVendorClosed = !cart.vendor?.isOpen;
  const canCheckout = !isVendorClosed && !hasUnavailableItems;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <AppText variant="h2" style={{ marginBottom: spacing.sm }}>{cart.vendor?.name}</AppText>
        
        {isVendorClosed && (
          <View style={{ marginBottom: spacing.md }}>
            <Badge label="This stall is closed right now" tone="red" />
          </View>
        )}

        {hasUnavailableItems && (
          <View style={{ marginBottom: spacing.md }}>
            <Badge label="Remove sold-out items to proceed" tone="red" />
          </View>
        )}

        {cart.items.map((item) => (
          <View key={item.id}>
            <View style={styles.row}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <AppText variant="bodyBold">{item.name}</AppText>
                {item.options.length > 0 && (
                  <AppText variant="caption" color={colors.textMuted}>
                    {item.options.map((o) => o.name).join(', ')}
                  </AppText>
                )}
                {item.instructions ? (
                  <AppText variant="caption" color={colors.primary} style={{ marginTop: 2 }}>
                    Note: {item.instructions}
                  </AppText>
                ) : null}
                {!item.isAvailable && (
                  <View style={{ marginTop: 4 }}>
                    <Badge label="No longer available" tone="red" />
                  </View>
                )}
                <AppText variant="price" style={{ marginTop: 4 }}>
                  {formatPaise(item.lineTotalPaise)}
                </AppText>
              </View>

              <QuantityStepper
                value={item.quantity}
                disabled={busyItemId === item.id}
                onChange={(v) => changeQty(item.id, v)}
              />
            </View>
            <Divider />
          </View>
        ))}

        <View style={styles.summaryRow}>
          <AppText variant="body">Subtotal</AppText>
          <AppText variant="bodyBold">{formatPaise(cart.subtotalPaise)}</AppText>
        </View>
        <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
          Delivery fee, platform fee and tax are calculated at checkout.
        </AppText>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          onPress={() => router.push('/(customer)/cart/checkout')}
          disabled={!canCheckout}
        >
          Proceed to checkout
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, alignItems: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
});
