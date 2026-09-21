import React from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { colors, radius, spacing } from '../theme/tokens';
import { AppText, Badge } from './ui';
import { formatPaise } from '../lib/money';
import type { VendorSummary } from '../features/catalog/api';

export function VendorCard({ vendor }: { vendor: VendorSummary }) {
  return (
    <Link href={`/vendor/${vendor.slug}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.imageWrap}>
          {vendor.coverUrl ? (
            <Image source={{ uri: vendor.coverUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <AppText variant="h1">🍽️</AppText>
            </View>
          )}
          {!vendor.isOpen && (
            <View style={styles.closedOverlay}>
              <Badge label={vendor.nextOpening ?? 'Closed'} tone="red" />
            </View>
          )}
        </View>
        <View style={{ padding: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="h3" style={{ flex: 1 }}>{vendor.name}</AppText>
            <Badge label={`★ ${vendor.ratingAvg.toFixed(1)}`} tone="green" />
          </View>
          <AppText variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
            {vendor.etaMinutes} min · {formatPaise(vendor.deliveryFeePaise)} delivery · {(vendor.distanceMeters / 1000).toFixed(1)} km
          </AppText>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.md },
  imageWrap: { height: 120, backgroundColor: '#eee' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EAE0' },
  closedOverlay: { position: 'absolute', top: spacing.sm, right: spacing.sm },
});
