import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="vendor/[slug]" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="cart/index" options={{ headerShown: true, title: 'Your cart' }} />
      <Stack.Screen name="cart/checkout" options={{ headerShown: true, title: 'Checkout' }} />
      <Stack.Screen name="orders/[id]" options={{ headerShown: true, title: 'Order' }} />
      <Stack.Screen name="profile/addresses" options={{ headerShown: true, title: 'Addresses' }} />
      <Stack.Screen name="profile/add-address" options={{ headerShown: true, title: 'Add address' }} />
    </Stack>
  );
}
