import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { AppText } from './ui';
import type { OrderStatus } from '../features/orders/api';

const TIMELINE: Array<{ key: OrderStatus; label: string }> = [
  { key: 'PLACED', label: 'Order placed' },
  { key: 'ACCEPTED', label: 'Vendor accepted' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Food ready' },
  { key: 'ASSIGNED', label: 'Partner assigned' },
  { key: 'PICKED_UP', label: 'Picked up' },
  { key: 'ON_THE_WAY', label: 'On the way' },
  { key: 'DELIVERED', label: 'Delivered' },
];

export function OrderStatusStepper({ status, events }: { status: OrderStatus; events: Array<{ status: OrderStatus; createdAt: string }> }) {
  if (status === 'CANCELLED') {
    return (
      <View style={styles.cancelled}>
        <AppText variant="bodyBold" color={colors.danger}>This order was cancelled</AppText>
      </View>
    );
  }
  const currentIndex = TIMELINE.findIndex((s) => s.key === status);
  const timeFor = (key: OrderStatus) => events.find((e) => e.status === key)?.createdAt;

  return (
    <View>
      {TIMELINE.map((step, i) => {
        const done = i <= currentIndex;
        const time = timeFor(step.key);
        return (
          <View key={step.key} style={{ flexDirection: 'row' }}>
            <View style={{ alignItems: 'center', width: 24 }}>
              <View style={[styles.dot, done && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
              {i < TIMELINE.length - 1 && <View style={[styles.line, done && i < currentIndex && { backgroundColor: colors.primary }]} />}
            </View>
            <View style={{ flex: 1, paddingBottom: spacing.lg, marginLeft: spacing.sm }}>
              <AppText variant="bodyBold" color={done ? colors.text : colors.textMuted}>{step.label}</AppText>
              {time && <AppText variant="caption" color={colors.textMuted}>{new Date(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</AppText>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: '#fff' },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 },
  cancelled: { padding: spacing.md, backgroundColor: '#FBE7E7', borderRadius: 12 },
});
