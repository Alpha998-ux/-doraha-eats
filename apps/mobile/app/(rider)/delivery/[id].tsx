import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, Linking, TextInput, Pressable, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Screen, AppText, Button, Card, LoadingBlock, Badge, ErrorState } from '../../../src/components/ui';
import { colors, spacing, radius } from '../../../src/theme/tokens';
import { getDeliveryOrder, setDeliveryStatus } from '../../../src/features/rider/api';
import type { OrderDetail } from '../../../src/features/orders/api';
import { formatPaise } from '../../../src/lib/money';
import { ApiError } from '../../../src/lib/api';
import { t } from '../../../src/lib/i18n';

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [nav, setNav] = useState<{ pickup: string; drop: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collected, setCollected] = useState('');
  const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const isMounted = useRef(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { order, navigation } = await getDeliveryOrder(id);
      if (isMounted.current) {
        setOrder(order);
        setNav(navigation);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof ApiError ? e.message : 'Could not load delivery details.');
      }
    }
  }, [id]);

  useEffect(() => {
    isMounted.current = true;
    load();

    // Track live rider location using expo-location
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        if (isMounted.current) {
          setRiderLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      }
    })();

    return () => {
      isMounted.current = false;
    };
  }, [load]);

  async function openMap(url?: string) {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open map navigation application.');
      }
    } catch {
      Alert.alert('Error', 'Could not launch maps application.');
    }
  }

  async function makeCall(phone?: string) {
    if (!phone) return;
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      Alert.alert('Error', 'Unable to place call.');
    }
  }

  async function updateStatus(status: 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED') {
    if (busy || !order) return;

    if (status === 'DELIVERED' && order.paymentMethod === 'COD') {
      const expectedAmount = order.totalPaise / 100;
      const enteredAmount = parseFloat(collected.trim());

      if (isNaN(enteredAmount) || Math.abs(enteredAmount - expectedAmount) > 0.01) {
        setError(`Please enter the exact collected COD amount (₹${expectedAmount.toFixed(2)}).`);
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      const codPaise = status === 'DELIVERED' && order.paymentMethod === 'COD'
        ? Math.round(parseFloat(collected.trim()) * 100)
        : undefined;

      const { order: o } = await setDeliveryStatus(id, status, codPaise);
      if (isMounted.current) {
        setOrder(o);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof ApiError ? e.message : 'Could not update delivery status.');
      }
    } finally {
      if (isMounted.current) {
        setBusy(false);
      }
    }
  }

  if (error && !order) return <Screen><ErrorState message={error} onRetry={load} /></Screen>;
  if (!order) return <Screen><LoadingBlock /></Screen>;

  const expectedCodRupees = (order.totalPaise / 100).toFixed(2);
  
  // Default drop-off fallback coordinate in Doraha if exact coords aren't attached yet
  const dropOffCoord = {
    latitude: 30.8200,
    longitude: 76.0400,
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.headerRow}>
          <AppText variant="h2">{order.code}</AppText>
          <Badge label={order.statusLabel} tone="blue" />
        </View>

        {/* Live Map Preview for Rider */}
        <Card style={{ marginTop: spacing.lg, padding: 0, overflow: 'hidden', height: 200 }}>
          <MapView
            style={styles.map}
            region={
              riderLocation
                ? {
                    latitude: riderLocation.latitude,
                    longitude: riderLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }
                : {
                    latitude: dropOffCoord.latitude,
                    longitude: dropOffCoord.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }
            }
            showsUserLocation={true}
          >
            <Marker coordinate={dropOffCoord} title="Customer Drop-off" pinColor="green" />
            {riderLocation && (
              <Polyline coordinates={[riderLocation, dropOffCoord]} strokeColor="#E8552D" strokeWidth={3} />
            )}
          </MapView>
        </Card>

        <Card style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
          <AppText variant="bodyBold">Pickup (Stall)</AppText>
          <AppText variant="body" style={{ marginTop: spacing.xs }}>{order.vendor.name}</AppText>
          {nav?.pickup && (
            <View style={{ marginTop: spacing.sm }}>
              <Button variant="secondary" onPress={() => openMap(nav.pickup)}>
                Navigate to stall
              </Button>
            </View>
          )}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <AppText variant="bodyBold">Drop-off (Customer)</AppText>
          <AppText variant="body" style={{ marginTop: spacing.xs }}>
            {order.addressLine}, {order.addressArea}
          </AppText>
          {order.contactPhone && (
            <Pressable onPress={() => makeCall(order.contactPhone)} style={{ marginTop: spacing.xs }}>
              <AppText variant="caption" color={colors.primary}>
                Call customer: {order.contactPhone}
              </AppText>
            </Pressable>
          )}
          {nav?.drop && (
            <View style={{ marginTop: spacing.sm }}>
              <Button variant="secondary" onPress={() => openMap(nav.drop)}>
                Navigate to customer
              </Button>
            </View>
          )}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <AppText variant="body">Order Total</AppText>
          <AppText variant="h3">{formatPaise(order.totalPaise)}</AppText>
          <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            Payment Method: {order.paymentMethod}
          </AppText>
        </Card>

        {error && (
          <AppText variant="body" color={colors.danger} style={{ marginBottom: spacing.md }}>
            {error}
          </AppText>
        )}

        {order.status === 'ASSIGNED' && (
          <Button onPress={() => updateStatus('PICKED_UP')} loading={busy}>
            {t('pickedUp')}
          </Button>
        )}

        {order.status === 'PICKED_UP' && (
          <Button onPress={() => updateStatus('ON_THE_WAY')} loading={busy}>
            {t('onTheWay')}
          </Button>
        )}

        {order.status === 'ON_THE_WAY' && (
          <View style={{ gap: spacing.sm }}>
            {order.paymentMethod === 'COD' && (
              <TextInput
                value={collected}
                onChangeText={(text) => {
                  setCollected(text);
                  if (error) setError(null);
                }}
                keyboardType="decimal-pad"
                placeholder={`Amount collected (₹${expectedCodRupees})`}
                style={styles.input}
              />
            )}
            <Button onPress={() => updateStatus('DELIVERED')} loading={busy}>
              {t('markDelivered')}
            </Button>
          </View>
        )}

        {order.status === 'DELIVERED' && <Badge label="Delivered" tone="green" />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: '#FFF',
  },
});
