import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, AppText, Button, Badge, LoadingBlock, EmptyState, ErrorState } from '../../../src/components/ui';
import { colors, spacing, radius } from '../../../src/theme/tokens';
import { listAddresses, type Address } from '../../../src/features/orders/api';
import { resolveLocation } from '../../../src/features/catalog/api';
import { useLocationStore } from '../../../src/store/locationStore';
import { ApiError } from '../../../src/lib/api';

export default function AddressesScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setResolved = useLocationStore((s) => s.setResolved);
  const setAddress = useLocationStore((s) => s.setAddress);

  const isMounted = useRef(true);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await listAddresses();
      if (isMounted.current) {
        setAddresses(res.addresses);
        setError(null);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof ApiError ? e.message : 'Failed to load saved addresses.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      loadAddresses();
      return () => {
        isMounted.current = false;
      };
    }, [loadAddresses])
  );

  function handleRefresh() {
    setRefreshing(true);
    loadAddresses();
  }

  async function select(a: Address) {
    if (selectedId) return;
    if (!a.zoneId) {
      Alert.alert('Outside Zone', 'This address is outside our current Doraha delivery area.');
    }

    setSelectedId(a.id);
    setError(null);

    try {
      const r = await resolveLocation(a.latitude, a.longitude);
      setResolved(r.serviceable, r.zone);
      setAddress(a.id, a.area);
      if (isMounted.current) {
        router.replace('/(customer)/(tabs)');
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof ApiError ? e.message : 'Could not resolve delivery location.');
        setSelectedId(null);
      }
    }
  }

  if (error && addresses.length === 0) {
    return <Screen><ErrorState message={error} onRetry={loadAddresses} /></Screen>;
  }

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen style={{ padding: spacing.lg }}>
      <AppText variant="h1" style={{ marginBottom: spacing.md }}>
        Saved Addresses
      </AppText>

      {error && (
        <AppText variant="body" color={colors.danger} style={{ marginBottom: spacing.md }}>
          {error}
        </AppText>
      )}

      <FlatList
        data={addresses}
        keyExtractor={(a) => a.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <EmptyState title="No saved addresses" subtitle="Add an address to check delivery availability." />
        }
        renderItem={({ item }) => {
          const isBusy = selectedId === item.id;
          return (
            <Pressable
              onPress={() => select(item)}
              disabled={!!selectedId}
              style={[
                styles.card,
                isBusy && styles.cardBusy,
                !item.zoneId && styles.cardUnserviceable,
              ]}
            >
              <View style={styles.headerRow}>
                <AppText variant="bodyBold">{item.label}</AppText>
                {item.isDefault && <Badge label="Default" tone="green" />}
              </View>

              <AppText variant="body" color={colors.textMuted}>
                {item.line1}, {item.area}
              </AppText>

              {!item.zoneId && (
                <View style={{ marginTop: spacing.xs }}>
                  <Badge label="Outside delivery area" tone="red" />
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <View style={{ marginTop: spacing.md }}>
        <Button onPress={() => router.push('/(customer)/profile/add-address')}>
          + Add new address
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: '#fff',
    gap: 4,
  },
  cardBusy: {
    opacity: 0.6,
  },
  cardUnserviceable: {
    borderColor: colors.danger,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
