import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, Image, View, StyleSheet, Pressable, Modal, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Screen, AppText, LoadingBlock, ErrorState, Badge, Button, Divider } from '../../../../src/components/ui';
import { FoodItemRow } from '../../../../src/components/FoodItemRow';
import { colors, radius, spacing } from '../../../../src/theme/tokens';
import { getVendor, type VendorDetail, type MenuSection, type FoodItem, type CustomizationGroup } from '../../../../src/features/catalog/api';
import { addToCart, clearCart } from '../../../../src/features/cart/api';
import { useCartStore } from '../../../../src/store/cartStore';
import { ApiError } from '../../../../src/lib/api';
import { formatPaise } from '../../../../src/lib/money';
import { t } from '../../../../src/lib/i18n';

export default function VendorDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [menu, setMenu] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<FoodItem | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const isMounted = useRef(true);

  const setCart = useCartStore((s) => s.setCart);
  const cart = useCartStore((s) => s.cart);

  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    setError(null);

    getVendor(slug)
      .then(({ vendor, menu }) => {
        if (!isMounted.current) return;
        setVendor(vendor);
        setMenu(menu);
        navigation.setOptions({ title: vendor.name });
      })
      .catch((e) => {
        if (!isMounted.current) return;
        setError(e instanceof ApiError ? e.message : 'Failed to load this stall.');
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });

    return () => {
      isMounted.current = false;
    };
  }, [slug]);

  if (loading) return <Screen><LoadingBlock /></Screen>;
  if (error || !vendor) return <Screen><ErrorState message={error ?? 'Stall not found.'} /></Screen>;

  const itemCount = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  async function quickAdd(item: FoodItem) {
    if (!vendor?.isOpen) {
      Alert.alert(t('stallClosed') ?? 'Stall Closed', 'This stall is currently closed and not accepting orders.');
      return;
    }
    if (!item.isAvailable) {
      Alert.alert('Item Sold Out', 'This item is currently unavailable.');
      return;
    }

    setAddingId(item.id);
    try {
      const { cart: newCart } = await addToCart({ foodItemId: item.id, quantity: 1 });
      if (isMounted.current) setCart(newCart);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DIFFERENT_VENDOR') {
        Alert.alert(
          'Replace cart items?',
          'Your cart contains items from another stall. Replace them with items from this stall?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace',
              style: 'destructive',
              onPress: async () => {
                try {
                  await clearCart();
                  const { cart: replacedCart } = await addToCart({ foodItemId: item.id, quantity: 1 });
                  if (isMounted.current) setCart(replacedCart);
                } catch (err) {
                  Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not reset cart.');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', e instanceof ApiError ? e.message : 'Could not add item to cart.');
      }
    } finally {
      if (isMounted.current) setAddingId(null);
    }
  }

  function handleItemPress(item: FoodItem) {
    if (!vendor?.isOpen) {
      Alert.alert('Stall Closed', 'This stall is currently not accepting new orders.');
      return;
    }
    if (!item.isAvailable) {
      Alert.alert('Item Sold Out', 'This item is currently unavailable.');
      return;
    }
    if (item.customizationGroups.length > 0) {
      setPicker(item);
    } else {
      quickAdd(item);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: itemCount ? 90 : spacing.xxl }}>
        <View style={styles.cover}>
          {vendor.coverUrl ? <Image source={{ uri: vendor.coverUrl }} style={styles.coverImg} /> : <AppText variant="h1">🍽️️</AppText>}
        </View>

        <View style={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="h1" style={{ flex: 1 }}>{vendor.name}</AppText>
            <Badge label={vendor.isOpen ? t('open') : (vendor.nextOpening ?? t('closed'))} tone={vendor.isOpen ? 'green' : 'red'} />
          </View>
          {vendor.about ? <AppText variant="body" color={colors.textMuted} style={{ marginTop: 4 }}>{vendor.about}</AppText> : null}
          <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
            ★ {vendor.ratingAvg.toFixed(1)} ({vendor.ratingCount})  ·  {vendor.etaMinutes} min  ·  {formatPaise(vendor.deliveryFeePaise)} delivery
          </AppText>
          <AppText variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{vendor.addressLine}</AppText>
        </View>

        <Divider />

        {menu.map((section) => (
          <View key={section.id} style={{ paddingHorizontal: spacing.lg }}>
            <AppText variant="h2" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{section.name}</AppText>
            {section.foodItems.map((item) => (
              <FoodItemRow
                key={item.id}
                item={item}
                disabled={!vendor.isOpen || !item.isAvailable || addingId === item.id}
                onPress={() => handleItemPress(item)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {itemCount > 0 && (
        <Pressable onPress={() => router.push('/(customer)/cart')} style={styles.cartBar}>
          <AppText variant="bodyBold" color="#fff">{itemCount} item{itemCount > 1 ? 's' : ''} added</AppText>
          <AppText variant="bodyBold" color="#fff">{t('viewCart')} →</AppText>
        </Pressable>
      )}

      <Modal visible={!!picker} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        {picker && (
          <CustomizationSheet
            item={picker}
            onClose={() => setPicker(null)}
            onAdded={(c) => {
              setCart(c);
              setPicker(null);
            }}
          />
        )}
      </Modal>
    </Screen>
  );
}

function CustomizationSheet({
  item,
  onClose,
  onAdded,
}: {
  item: FoodItem;
  onClose: () => void;
  onAdded: (c: import('../../../../src/store/cartStore').CartView) => void;
}) {
  const [selections, setSelections] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      item.customizationGroups.map((g) => [
        g.id,
        g.options.filter((o) => o.isDefault && o.isAvailable).map((o) => o.id),
      ])
    )
  );
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(group: CustomizationGroup, optionId: string, isOptionAvailable: boolean) {
    if (!isOptionAvailable) return;

    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (group.maxSelect === 1) return { ...prev, [group.id]: [optionId] };
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      if (next.length > group.maxSelect) return prev;
      return { ...prev, [group.id]: next };
    });
  }

  const deltaTotal = item.customizationGroups.reduce((sum, g) => {
    const chosen = selections[g.id] ?? [];
    return sum + g.options.filter((o) => chosen.includes(o.id)).reduce((s, o) => s + o.priceDeltaPaise, 0);
  }, 0);
  const unitPrice = item.pricePaise + deltaTotal;

  async function confirm() {
    for (const g of item.customizationGroups) {
      const chosen = selections[g.id] ?? [];
      if (chosen.length < g.minSelect) {
        setError(`Please choose at least ${g.minSelect} option for ${g.name}.`);
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const optionIds = Object.values(selections).flat();
      const { cart } = await addToCart({
        foodItemId: item.id,
        quantity,
        optionIds,
        instructions: instructions.trim() || undefined,
      });
      onAdded(cart);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DIFFERENT_VENDOR') {
        setError('Cart contains items from another stall. Please clear your cart first.');
      } else {
        setError(e instanceof ApiError ? e.message : 'Could not add to cart.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.sheetWrap}>
      <View style={styles.sheet}>
        <ScrollView>
          <AppText variant="h2">{item.name}</AppText>
          {item.description ? <AppText variant="body" color={colors.textMuted} style={{ marginTop: 4 }}>{item.description}</AppText> : null}

          {item.customizationGroups.map((g) => (
            <View key={g.id} style={{ marginTop: spacing.lg }}>
              <AppText variant="h3">
                {g.name}
                {g.minSelect > 0 ? ' (required)' : ''}
              </AppText>
              {g.options.map((o) => {
                const selected = (selections[g.id] ?? []).includes(o.id);
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => toggle(g, o.id, o.isAvailable)}
                    style={[styles.optionRow, !o.isAvailable && { opacity: 0.5 }]}
                    disabled={!o.isAvailable}
                  >
                    <View
                      style={[
                        styles.radio,
                        g.maxSelect === 1 && { borderRadius: 10 },
                        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    />
                    <AppText variant="body" style={{ flex: 1, marginLeft: spacing.sm }}>
                      {o.name} {!o.isAvailable ? '(Sold Out)' : ''}
                    </AppText>
                    {o.priceDeltaPaise > 0 && (
                      <AppText variant="caption" color={colors.textMuted}>
                        +{formatPaise(o.priceDeltaPaise)}
                      </AppText>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}

          <AppText variant="h3" style={{ marginTop: spacing.lg }}>{t('cookingInstructions')}</AppText>
          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            placeholder="e.g. less spicy, extra green chutney"
            placeholderTextColor={colors.textMuted}
            style={styles.noteBox}
            maxLength={150}
          />
        </ScrollView>

        {error && <AppText variant="body" color={colors.danger} style={{ marginVertical: spacing.sm }}>{error}</AppText>}

        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={styles.qtyBtn}>
              <AppText variant="h3">−</AppText>
            </Pressable>
            <AppText variant="h3">{quantity}</AppText>
            <Pressable onPress={() => setQuantity((q) => Math.min(20, q + 1))} style={styles.qtyBtn}>
              <AppText variant="h3">+</AppText>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Button onPress={confirm} loading={busy}>
              {t('addToCart')} · {formatPaise(unitPrice * quantity)}
            </Button>
          </View>
        </View>
        <Button variant="ghost" onPress={onClose} style={{ marginTop: spacing.xs }}>Cancel</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 180, backgroundColor: '#F1EAE0', alignItems: 'center', justifyContent: 'center' },
  coverImg: { width: '100%', height: '100%' },
  cartBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  sheetWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  radio: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.border },
  noteBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
