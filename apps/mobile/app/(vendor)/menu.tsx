import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, Switch, RefreshControl } from 'react-native';
import { Screen, AppText, LoadingBlock, EmptyState, ErrorState, Card } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme/tokens';
import { getVendorMenu, setItemAvailability, toggleVendorOpenStatus, type MenuSectionAdmin } from '../../src/features/vendor/api';
import { formatPaise } from '../../src/lib/money';
import { ApiError } from '../../src/lib/api';

export default function VendorMenuScreen() {
  const [sections, setSections] = useState<MenuSectionAdmin[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);

  async function loadMenu() {
    try {
      const res = await getVendorMenu();
      if (isMounted.current) {
        setSections(res.sections);
        setIsOpen(res.isVendorOpen ?? true);
        setError(null);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof ApiError ? e.message : 'Failed to load vendor menu.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    isMounted.current = true;
    loadMenu();
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    loadMenu();
  }

  async function handleToggleStoreStatus(newStatus: boolean) {
    const previousStatus = isOpen;
    setIsOpen(newStatus);
    setError(null);

    try {
      await toggleVendorOpenStatus(newStatus);
    } catch (e) {
      if (isMounted.current) {
        setIsOpen(previousStatus);
        setError(e instanceof ApiError ? e.message : 'Could not update stall open status.');
      }
    }
  }

  async function toggle(itemId: string, current: boolean) {
    if (busyItemId === itemId) return;
    setBusyItemId(itemId);
    setError(null);

    // Optimistically update local state
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        foodItems: s.foodItems.map((i) => (i.id === itemId ? { ...i, isAvailable: !current } : i)),
      }))
    );

    try {
      await setItemAvailability(itemId, !current);
    } catch (e) {
      // Revert optimistic update on failure
      if (isMounted.current) {
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            foodItems: s.foodItems.map((i) => (i.id === itemId ? { ...i, isAvailable: current } : i)),
          }))
        );
        setError(e instanceof ApiError ? e.message : 'Could not update item availability.');
      }
    } finally {
      if (isMounted.current) {
        setBusyItemId(null);
      }
    }
  }

  if (error && sections.length === 0) {
    return <Screen><ErrorState message={error} onRetry={loadMenu} /></Screen>;
  }

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <AppText variant="h1" style={{ marginBottom: spacing.md }}>
          Menu & Stall Status
        </AppText>

        {/* Master Stall Status Card */}
        <Card style={styles.storeCard}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <AppText variant="bodyBold">Stall Operating Status</AppText>
              <AppText variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                {isOpen ? 'Your cart is open for Doraha customers.' : 'Your cart is closed. No new orders accepted.'}
              </AppText>
            </View>
            <Switch
              value={isOpen}
              onValueChange={handleToggleStoreStatus}
              trackColor={{ true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>
        </Card>

        {error && (
          <AppText variant="body" color={colors.danger} style={{ marginBottom: spacing.md }}>
            {error}
          </AppText>
        )}

        {sections.length === 0 ? (
          <EmptyState title="No items found" subtitle="No menu sections or items have been created yet." />
        ) : (
          sections.map((section) => (
            <View key={section.id} style={{ marginBottom: spacing.lg }}>
              <AppText variant="h3" style={{ marginBottom: spacing.sm }}>
                {section.name}
              </AppText>
              {section.foodItems.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyBold">{item.name}</AppText>
                    <AppText variant="caption" color={colors.textMuted}>
                      {formatPaise(item.pricePaise)}
                    </AppText>
                  </View>
                  <Switch
                    value={item.isAvailable}
                    onValueChange={() => toggle(item.id, item.isAvailable)}
                    disabled={busyItemId === item.id}
                    trackColor={{ true: colors.primary }}
                    thumbColor="#FFF"
                  />
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  storeCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
