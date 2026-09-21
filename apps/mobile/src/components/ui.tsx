import React from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, type ViewStyle, type TextStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
}

export function AppText({
  children, variant = 'body', color, style,
}: { children: React.ReactNode; variant?: keyof typeof typography; color?: string; style?: TextStyle }) {
  // Punjabi (Gurmukhi) needs more line-height than Latin at the same size, or it clips.
  const base = typography[variant];
  return (
    <Text style={[base, { color: color ?? colors.text, lineHeight: base.lineHeight * 1.15 }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  children, onPress, variant = 'primary', disabled, loading, fullWidth = true,
}: {
  children: React.ReactNode; onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean; loading?: boolean; fullWidth?: boolean;
}) {
  const bg = {
    primary: colors.primary, secondary: colors.surface, ghost: 'transparent', danger: colors.danger,
  }[variant];
  const fg = variant === 'secondary' || variant === 'ghost' ? colors.text : '#fff';
  const border = variant === 'secondary' ? colors.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
        fullWidth ? { width: '100%' } : undefined,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{children}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && { backgroundColor: colors.primary }]}>
      <Text style={{ color: selected ? '#fff' : colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'green' | 'red' | 'yellow' | 'blue' }) {
  const bg = { neutral: '#EEE', green: '#E4F5EA', red: '#FBE7E7', yellow: '#FDF2D9', blue: '#E5EEFC' }[tone];
  const fg = { neutral: colors.textMuted, green: colors.success, red: colors.danger, yellow: colors.warning, blue: '#2A5FBF' }[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function VegDot({ isVeg }: { isVeg: boolean }) {
  const c = isVeg ? colors.success : colors.danger;
  return (
    <View style={{ width: 14, height: 14, borderWidth: 1.5, borderColor: c, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c }} />
    </View>
  );
}

export function QuantityStepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepperBtn}>
        <Text style={styles.stepperText}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 20, textAlign: 'center', fontWeight: '700' }}>{value}</Text>
      <Pressable onPress={() => onChange(value + 1)} style={styles.stepperBtn}>
        <Text style={styles.stepperText}>+</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
      <AppText variant="h3" style={{ textAlign: 'center', marginBottom: 4 }}>{title}</AppText>
      {subtitle && <AppText variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>{subtitle}</AppText>}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
      <AppText variant="body" color={colors.danger} style={{ textAlign: 'center', marginBottom: spacing.md }}>{message}</AppText>
      {onRetry && <Button variant="secondary" onPress={onRetry} fullWidth={false}>Retry</Button>}
    </View>
  );
}

export function LoadingBlock() {
  return (
    <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 13, paddingHorizontal: spacing.lg, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  chip: {
    backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2,
  },
  stepperBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
