import React, { useState } from 'react';
import { TextInput, ScrollView, StyleSheet, Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, LoadingBlock, EmptyState } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/theme/tokens';
import { search } from '../../../src/features/catalog/api';
import { useLocationStore } from '../../../src/store/locationStore';
import { formatPaise } from '../../../src/lib/money';
import { t } from '../../../src/lib/i18n';

export default function SearchScreen() {
  const router = useRouter();
  const zone = useLocationStore((s) => s.zone);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof search>> | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(text: string) {
    setQ(text);
    if (!zone || text.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    try { setResults(await search(text.trim(), zone.id)); } finally { setLoading(false); }
  }

  return (
    <Screen style={{ padding: spacing.lg }}>
      <TextInput
        value={q} onChangeText={run} placeholder={t('search')} autoFocus
        style={styles.input}
      />
      {loading && <LoadingBlock />}
      {!loading && results && (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          {results.vendors.length === 0 && results.items.length === 0 && (
            <EmptyState title="No results" subtitle={`Nothing matched "${q}" nearby.`} />
          )}
          {results.vendors.length > 0 && (
            <>
              <AppText variant="h3" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>Stalls</AppText>
              {results.vendors.map((v) => (
                <Pressable key={v.id} onPress={() => router.push(`/(customer)/vendor/${v.slug}`)} style={styles.row}>
                  <AppText variant="bodyBold">{v.name}</AppText>
                  <AppText variant="caption" color={colors.textMuted}>★ {v.ratingAvg.toFixed(1)} ({v.ratingCount})</AppText>
                </Pressable>
              ))}
            </>
          )}
          {results.items.length > 0 && (
            <>
              <AppText variant="h3" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Dishes</AppText>
              {results.items.map((it) => (
                <Pressable key={it.id} onPress={() => router.push(`/(customer)/vendor/${it.vendor.slug}`)} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyBold">{it.name}</AppText>
                    <AppText variant="caption" color={colors.textMuted}>{it.vendor.name}</AppText>
                  </View>
                  <AppText variant="price">{formatPaise(it.pricePaise)}</AppText>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
