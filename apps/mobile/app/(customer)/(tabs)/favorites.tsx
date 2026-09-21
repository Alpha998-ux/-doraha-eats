import React from 'react';
import { Screen, AppText, EmptyState } from '../../../src/components/ui';
import { spacing } from '../../../src/theme/tokens';

export default function FavoritesTab() {
  return (
    <Screen style={{ padding: spacing.lg }}>
      <AppText variant="h1" style={{ marginBottom: spacing.md }}>Favorites</AppText>
      <EmptyState title="No favorites yet" subtitle="Tap the heart on a stall or dish to save it here." />
    </Screen>
  );
}
