import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, AppText, Button, Badge, LoadingBlock, EmptyState } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/theme/tokens';
import { listAddresses, type Address } from '../../../src/features/orders/api';
import { resolveLocation } from '../../../src/features/catalog/api';
import { useLocationStore } from '../../../src/store/locationStore';

export default function AddressesScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const setResolved = useLocationStore((s) => s.setResolved);
  const setAddress = useLocationStore((s) => s.setAddress);

  useFocusEffect(useCallback(() => {
    listAddresses().then(({ addresses }) => setAddresses(addresses)).finally(() => setLoading(false));
  }, []));

  async function select(a: Address) {
    const r = await resolveLocation(a.latitude, a.longitude);
    setResolved(r.serviceable, r.zone);
    setAddress(a.id, a.area);
    router.replace('/(customer)/(tabs)');
  }

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen style={{ padding: spacing.lg }}>
      <FlatList
        data={addresses}
        keyExtractor={(a) => a.id}
        ListEmptyComponent={<EmptyState title="No saved addresses" subtitle="Add one to start ordering." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => select(item)} style={styles.card}>
            <AppText variant="bodyBold">{item.label} {item.isDefault && <Badge label="Default" tone="green" />}</AppText>
            <AppText variant="body" color={colors.textMuted}>{item.line1}, {item.area}</AppText>
            {!item.zoneId && <Badge label="Outside delivery area" tone="red" />}
          </Pressable>
        )}
      />
      <Button onPress={() => router.push('/(customer)/profile/add-address')}>+ Add new address</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, backgroundColor: '#fff', gap: 4 },
});
