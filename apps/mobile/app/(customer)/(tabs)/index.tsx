import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, FlatList, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, Chip, LoadingBlock, ErrorState, EmptyState, Badge } from '../../../src/components/ui';
import { VendorCard } from '../../../src/components/VendorCard';
import { colors, spacing } from '../../../src/theme/tokens';
import { getConfig, listVendors, resolveLocation, type AppConfig, type VendorSummary } from '../../../src/features/catalog/api';
import { useLocationStore } from '../../../src/store/locationStore';
import { listAddresses } from '../../../src/features/orders/api';
import { ApiError } from '../../../src/lib/api';
import { t } from '../../../src/lib/i18n';

export default function HomeScreen() {
  const router = useRouter();
  const { serviceable, zone, addressLabel, setResolved, setAddress } = useLocationStore();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const cfg = await getConfig();
      setConfig(cfg);

      // Resolve the customer's default saved address, or fall back to the
      // first active zone's centre so the demo flow works with no GPS.
      const { addresses } = await listAddresses();
      const primary = addresses.find((a) => a.isDefault) ?? addresses[0];

      let resolvedZone = zone;
      if (primary) {
        const r = await resolveLocation(primary.latitude, primary.longitude);
        setResolved(r.serviceable, r.zone);
        resolvedZone = r.zone;
        setAddress(primary.id, primary.area);
      } else if (cfg.serviceArea[0]) {
        const z = cfg.serviceArea[0];
        const r = await resolveLocation(z.latitude, z.longitude);
        setResolved(r.serviceable, r.zone);
        resolvedZone = r.zone;
      }

      if (resolvedZone) {
        const { vendors } = await listVendors(resolvedZone.id, activeCategory ? { categoryId: activeCategory } : undefined);
        setVendors(vendors);
      } else {
        setVendors([]);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [activeCategory]);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() { setRefreshing(true); await load(); }

  if (loading) return <Screen><LoadingBlock /></Screen>;
  if (error) return <Screen><ErrorState message={error} onRetry={load} /></Screen>;

  if (serviceable === false) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <AppText variant="h1">📍</AppText>
        <AppText variant="h2" style={{ textAlign: 'center', marginTop: spacing.md }}>{t('outOfZone')}</AppText>
        <AppText variant="body" color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.sm }}>
          We're only in Doraha right now. We'll let you know when we expand to your area.
        </AppText>
        <Pressable onPress={() => router.push('/(customer)/profile/add-address')} style={{ marginTop: spacing.lg }}>
          <AppText variant="bodyBold" color={colors.primary}>Change delivery location</AppText>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Pressable onPress={() => router.push('/(customer)/profile/addresses')}>
          <AppText variant="caption" color={colors.textMuted}>{t('deliverTo')}</AppText>
          <AppText variant="bodyBold" color={colors.primary}>{addressLabel ?? zone?.name ?? 'Doraha'} ▾</AppText>
        </Pressable>

        <AppText variant="h1" style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>{t('craving')}</AppText>

        <Pressable onPress={() => router.push('/(customer)/(tabs)/search')} style={styles.searchBar}>
          <AppText color={colors.textMuted}>{t('search')}</AppText>
        </Pressable>

        {config && (
          <FlatList
            horizontal showsHorizontalScrollIndicator={false}
            data={config.categories}
            keyExtractor={(c) => c.id}
            style={{ marginTop: spacing.lg }}
            renderItem={({ item }) => (
              <Chip
                label={`${item.icon ?? ''} ${item.name}`}
                selected={activeCategory === item.id}
                onPress={() => setActiveCategory(activeCategory === item.id ? null : item.id)}
              />
            )}
          />
        )}

        <AppText variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>{t('popularNearYou')}</AppText>
        {vendors.length === 0 ? (
          <EmptyState title="No stalls found" subtitle="Try a different category or check back later." />
        ) : (
          vendors.map((v) => <VendorCard key={v.id} vendor={v} />)
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff',
  },
});
