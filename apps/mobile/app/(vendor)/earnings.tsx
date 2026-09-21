import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Screen, AppText, Card, LoadingBlock } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme/tokens';
import { getVendorEarnings } from '../../src/features/vendor/api';
import { formatPaise } from '../../src/lib/money';

export default function VendorEarningsScreen() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getVendorEarnings>> | null>(null);

  useEffect(() => { getVendorEarnings().then(setData); }, []);

  if (!data) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen style={{ padding: spacing.lg }}>
      <AppText variant="h1" style={{ marginBottom: spacing.lg }}>Earnings</AppText>

      <Card style={{ marginBottom: spacing.md }}>
        <AppText variant="caption" color={colors.textMuted}>Today</AppText>
        <AppText variant="h2">{formatPaise(data.today.grossPaise)}</AppText>
        <AppText variant="caption" color={colors.textMuted}>{data.today.orders} orders</AppText>
      </Card>

      <Card>
        <AppText variant="caption" color={colors.textMuted}>All time</AppText>
        <AppText variant="h2">{formatPaise(data.allTime.netPaise)}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {data.allTime.orders} orders · gross {formatPaise(data.allTime.grossPaise)} · commission {formatPaise(data.allTime.commissionPaise)}
        </AppText>
      </Card>
    </Screen>
  );
}
