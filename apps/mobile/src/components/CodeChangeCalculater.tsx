import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { AppText, Card } from './ui';
import { colors, radius, spacing } from '../theme/tokens';
import { formatPaise } from '../lib/money';

interface CodChangeCalculatorProps {
  totalPaise: number;
}

const COMMON_DENOMINATIONS = [100, 200, 500, 2000];

export function CodChangeCalculator({ totalPaise }: CodChangeCalculatorProps) {
  const [tenderedAmount, setTenderedAmount] = useState('');
  
  const totalRupees = totalPaise / 100;
  const tenderedNum = parseFloat(tenderedAmount) || 0;
  const changeDue = tenderedNum > totalRupees ? tenderedNum - totalRupees : 0;

  return (
    <Card style={styles.card}>
      <AppText variant="bodyBold" style={{ marginBottom: spacing.xs }}>
        💵 COD Change Calculator
      </AppText>
      <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
        Order Total: <AppText variant="bodyBold" color={colors.primary}>{formatPaise(totalPaise)}</AppText>
      </AppText>

      {/* Quick Denomination Chips */}
      <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>
        Customer handing cash note:
      </AppText>
      <View style={styles.chipRow}>
        {COMMON_DENOMINATIONS.map((denom) => {
          if (denom < totalRupees) return null; // Don't show notes smaller than bill
          return (
            <Pressable
              key={denom}
              style={[styles.chip, tenderedAmount === denom.toString() && styles.activeChip]}
              onPress={() => setTenderedAmount(denom.toString())}
            >
              <AppText variant="caption" color={tenderedAmount === denom.toString() ? '#FFF' : colors.text}>
                ₹{denom}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Manual Input */}
      <TextInput
        value={tenderedAmount}
        onChangeText={setTenderedAmount}
        placeholder="Or enter custom cash amount received"
        keyboardType="decimal-pad"
        style={styles.input}
      />

      {/* Change Due Output */}
      {tenderedNum >= totalRupees && (
        <View style={styles.resultBox}>
          <AppText variant="bodyBold" color={colors.success}>
            Return Change to Customer: ₹{changeDue.toFixed(2)}
          </AppText>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', padding: spacing.md, marginVertical: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FAFAFA' },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, backgroundColor: '#FAFAFA', marginBottom: spacing.sm },
  resultBox: { backgroundColor: '#E8F5E9', padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
});
