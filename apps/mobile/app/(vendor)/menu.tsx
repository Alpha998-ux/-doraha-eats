import React, { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, Switch } from 'react-native';
import { Screen, AppText, LoadingBlock } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme/tokens';
import { getVendorMenu, setItemAvailability, type MenuSectionAdmin } from '../../src/features/vendor/api';
import { formatPaise } from '../../src/lib/money';

export default function VendorMenuScreen() {
  const [sections, setSections] = useState<MenuSectionAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getVendorMenu().then(({ sections }) => setSections(sections)).finally(() => setLoading(false)); }, []);

  async function toggle(itemId: string, current: boolean) {
    await setItemAvailability(itemId, !current);
    setSections((prev) => prev.map((s) => ({ ...s, foodItems: s.foodItems.map((i) => i.id === itemId ? { ...i, isAvailable: !current } : i) })));
  }

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {sections.map((section) => (
          <View key={section.id} style={{ marginBottom: spacing.lg }}>
            <AppText variant="h3" style={{ marginBottom: spacing.sm }}>{section.name}</AppText>
            {section.foodItems.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyBold">{item.name}</AppText>
                  <AppText variant="caption" color={colors.textMuted}>{formatPaise(item.pricePaise)}</AppText>
                </View>
                <Switch value={item.isAvailable} onValueChange={() => toggle(item.id, item.isAvailable)} trackColor={{ true: colors.primary }} />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
