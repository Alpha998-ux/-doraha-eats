import React, { useState } from 'react';
import { ScrollView, TextInput, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, Button, Chip } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/theme/tokens';
import { addAddress } from '../../../src/features/orders/api';
import { getConfig } from '../../../src/features/catalog/api';
import { useLocationStore } from '../../../src/store/locationStore';
import { ApiError } from '../../../src/lib/api';

/**
 * MVP location entry: the customer picks their area and types the address —
 * no paid maps API is required to run the app. We snap the pin to the chosen
 * zone's centre (with a small jitter) since street-level geocoding is a
 * later upgrade behind the same MapsProvider interface.
 */
export default function AddAddressScreen() {
  const router = useRouter();
  const [zones, setZones] = useState<Awaited<ReturnType<typeof getConfig>>['serviceArea']>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [label, setLabel] = useState<'HOME' | 'WORK' | 'OTHER'>('HOME');
  const [area, setArea] = useState('');
  const [line1, setLine1] = useState('');
  const [landmark, setLandmark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setResolved = useLocationStore((s) => s.setResolved);
  const setAddress = useLocationStore((s) => s.setAddress);

  React.useEffect(() => { getConfig().then((c) => { setZones(c.serviceArea); setZoneId(c.serviceArea[0]?.id ?? null); }); }, []);

  async function save() {
    setError(null);
    if (!area.trim() || !line1.trim()) { setError('Please fill in the area and address.'); return; }
    const zone = zones.find((z) => z.id === zoneId);
    setBusy(true);
    try {
      const jitter = () => (Math.random() - 0.5) * 0.004;
      const latitude = (zone?.latitude ?? 30.7996) + jitter();
      const longitude = (zone?.longitude ?? 76.0236) + jitter();
      const res = await addAddress({ label, area: area.trim(), line1: line1.trim(), landmark: landmark.trim() || undefined, latitude, longitude, isDefault: true });
      setResolved(res.serviceable, res.serviceable ? { id: zone!.id, name: zone!.name, deliveryFeePaise: zone!.deliveryFeePaise, minOrderPaise: zone!.minOrderPaise, etaMinutes: zone!.etaMinutes } : null);
      setAddress(res.address.id, res.address.area);
      router.replace('/(customer)/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save address.');
    } finally { setBusy(false); }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <AppText variant="h3" style={{ marginBottom: spacing.sm }}>Delivery area</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg }}>
          {zones.map((z) => <Chip key={z.id} label={z.name} selected={zoneId === z.id} onPress={() => setZoneId(z.id)} />)}
        </View>

        <AppText variant="h3" style={{ marginBottom: spacing.sm }}>Label</AppText>
        <View style={{ flexDirection: 'row', marginBottom: spacing.lg }}>
          {(['HOME', 'WORK', 'OTHER'] as const).map((l) => <Chip key={l} label={l} selected={label === l} onPress={() => setLabel(l)} />)}
        </View>

        <Field label="Area / locality"><TextInput value={area} onChangeText={setArea} style={styles.input} placeholder="e.g. Main Bazaar" /></Field>
        <Field label="Full address"><TextInput value={line1} onChangeText={setLine1} style={styles.input} placeholder="House no, street" multiline /></Field>
        <Field label="Landmark (optional)"><TextInput value={landmark} onChangeText={setLandmark} style={styles.input} placeholder="e.g. Near bus stand" /></Field>

        {error && <AppText variant="body" color={colors.danger} style={{ marginBottom: spacing.md }}>{error}</AppText>}
        <Button onPress={save} loading={busy}>Save address</Button>
      </ScrollView>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>{label}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: '#fff' },
});
