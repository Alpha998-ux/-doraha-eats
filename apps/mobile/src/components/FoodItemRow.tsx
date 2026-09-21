import React from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';
import { AppText, VegDot, Badge } from './ui';
import { formatPaise } from '../lib/money';
import type { FoodItem } from '../features/catalog/api';
import { t } from '../lib/i18n';

export function FoodItemRow({ item, onPress }: { item: FoodItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row} disabled={!item.isAvailable}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <VegDot isVeg={item.isVeg} />
        <AppText variant="bodyBold" style={{ marginTop: 6 }}>{item.name}</AppText>
        {item.description && <AppText variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{item.description}</AppText>}
        <AppText variant="price" style={{ marginTop: 6 }}>{formatPaise(item.pricePaise)}</AppText>
      </View>
      <View style={{ width: 96, alignItems: 'center' }}>
        <View style={styles.imageWrap}>
          {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <AppText variant="h2">🍲</AppText>}
        </View>
        {item.isAvailable ? (
          <Pressable onPress={onPress} style={styles.addBtn}>
            <AppText variant="bodyBold" color={colors.primary}>{t('addToCart')}</AppText>
          </Pressable>
        ) : (
          <View style={{ marginTop: 6 }}><Badge label="Unavailable" tone="red" /></View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  imageWrap: { width: 88, height: 72, borderRadius: radius.sm, backgroundColor: '#F1EAE0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  addBtn: { marginTop: -14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 6 },
});
