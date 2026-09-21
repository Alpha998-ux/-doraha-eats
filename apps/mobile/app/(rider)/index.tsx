import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, Pressable, Switch, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location' ;
import { Screen, AppText, Badge, Button, Card, LoadingBlock, EmptyState } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme/tokens';
import {
  getMyPartner, setOnline, listAvailableDeliveries, acceptDelivery, updateMyLocation,
  type PartnerProfile, type DeliveryJob,
} from '../../src/features/rider/api';
import { useAuthStore } from '../../src/store/authStore';
import { formatPaise } from '../../src/lib/money';
import { ApiError } from '../../src/lib/api';
import { t } from '../../src/lib/i18n';

export default function RiderDashboard() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [earnings, setEarnings] = useState<{ todayDeliveries: number; todayEarningsPaise: number } | null>(null);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([getMyPartner(), listAvailableDeliveries()]).then(([p, d]) => {
      setPartner(p.partner); setEarnings(p.earnings); setJobs(d.deliveries);
    }).catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load.')).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]));

  // Best-effort GPS ping while online; the app works fine without location permission too.
  useEffect(() => {
    if (!partner?.isOnline) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' as const }));
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 50 }, (pos: Location.LocationObject) => {
        updateMyLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
      });
    })();
    return () => sub?.remove();
  }, [partner?.isOnline]);

  async function toggleOnline() {
    if (!partner) return;
    const { partner: p } = await setOnline(!partner.isOnline);
    setPartner(p);
  }

  async function accept(job: DeliveryJob) {
    setBusy(job.orderId); setError(null);
    try {
      await acceptDelivery(job.orderId);
      router.push(`/(rider)/delivery/${job.orderId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'This delivery is no longer available.');
      load();
    } finally { setBusy(null); }
  }

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="h1">Deliveries</AppText>
          <Pressable onPress={logout}><AppText variant="caption" color={colors.danger}>Log out</AppText></Pressable>
        </View>

        {partner?.status !== 'ACTIVE' ? (
          <Card style={{ marginTop: spacing.lg }}>
            <AppText variant="bodyBold">Awaiting approval</AppText>
            <AppText variant="body" color={colors.textMuted}>An admin needs to approve your account before you can accept deliveries.</AppText>
          </Card>
        ) : (
          <Card style={{ marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <AppText variant="bodyBold">{partner.isOnline ? t('goOffline') : t('goOnline')}</AppText>
              <AppText variant="caption" color={colors.textMuted}>{partner.isOnline ? "You're visible for new jobs" : 'Go online to see jobs'}</AppText>
            </View>
            <Switch value={partner.isOnline} onValueChange={toggleOnline} trackColor={{ true: colors.primary }} />
          </Card>
        )}

        {earnings && (
          <Card style={{ marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <AppText variant="caption" color={colors.textMuted}>Today's earnings</AppText>
              <AppText variant="h3">{formatPaise(earnings.todayEarningsPaise)}</AppText>
            </View>
            <Pressable onPress={() => router.push('/(rider)/history')}>
              <AppText variant="bodyBold" color={colors.primary}>History →</AppText>
            </Pressable>
          </Card>
        )}

        {error && <AppText variant="body" color={colors.danger} style={{ marginTop: spacing.md }}>{error}</AppText>}

        <AppText variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>{t('availableOrders')}</AppText>
        {!partner?.isOnline ? (
          <EmptyState title="You're offline" subtitle="Go online to see available deliveries." />
        ) : jobs.length === 0 ? (
          <EmptyState title="No deliveries right now" subtitle="New jobs will appear here as stalls mark orders ready." />
        ) : (
          jobs.map((job) => (
            <Card key={job.orderId} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="bodyBold">{job.vendor.name}</AppText>
                <Badge label={formatPaise(job.payoutPaise)} tone="green" />
              </View>
              <AppText variant="caption" color={colors.textMuted}>
                {job.itemCount} item(s) · {job.paymentMethod === 'COD' ? `Collect ${formatPaise(job.codToCollectPaise)}` : 'Prepaid'}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>Drop: {job.dropArea}</AppText>
              <View style={{ marginTop: spacing.sm }}>
                <Button onPress={() => accept(job)} loading={busy === job.orderId} fullWidth={false}>Accept</Button>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
