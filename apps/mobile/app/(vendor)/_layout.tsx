import { Stack } from 'expo-router';
export default function VendorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="order/[id]" options={{ headerShown: true, title: 'Order' }} />
      <Stack.Screen name="menu" options={{ headerShown: true, title: 'Menu' }} />
      <Stack.Screen name="earnings" options={{ headerShown: true, title: 'Earnings' }} />
    </Stack>
  );
}
