import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Screen, AppText, Card, LoadingBlock, EmptyState, Badge } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme/tokens';
import { listHistory } from '../../src/features/rider/api';
import { formatPaise } from '../../src/lib/money';

export default function RiderHistoryScreen() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listHistory>>['history']>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listHistory().then(({ history }) => setRows(history)).finally(() => setLoading(false)); }, []);

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen style={{ padding: spacing.lg }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.assignmentId}
        ListEmptyComponent={<EmptyState title="No deliveries yet" />}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="bodyBold">{item.order.code}</AppText>
              <Badge label={formatPaise(item.payoutPaise)} tone="green" />
            </View>
            <AppText variant="caption" color={colors.textMuted}>{item.order.area} · {item.state}</AppText>
          </Card>
        )}
      />
    </Screen>
  );
}
