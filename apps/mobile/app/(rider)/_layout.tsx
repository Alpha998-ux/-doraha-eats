import { Stack } from 'expo-router';
export default function RiderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="delivery/[id]" options={{ headerShown: true, title: 'Delivery' }} />
      <Stack.Screen name="history" options={{ headerShown: true, title: 'History' }} />
    </Stack>
  );
}
