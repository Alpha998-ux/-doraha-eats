import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/store/authStore';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../src/theme/tokens';
import { registerForPushNotificationsAsync } from '../src/lib/notifications';

/**
 * A single Expo binary, three role-scoped route groups. This layout branches
 * on the logged-in user's role so a customer, a stall owner and a rider all
 * land in the right place from one app — see the mobile design doc for why.
 */
function RootNavigation() {
  const { user, token, hydrated, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { hydrate(); }, []);

  // Register push notifications and handle notification tap responses
  useEffect(() => {
    registerForPushNotificationsAsync().then((pushToken) => {
      if (pushToken) {
        console.log('Expo Push Token registered:', pushToken);
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { orderId?: string; role?: string };
      if (data?.orderId) {
        if (data.role === 'VENDOR') {
          router.push(`/(vendor)/order/${data.orderId}`);
        } else if (data.role === 'DELIVERY') {
          router.push(`/(rider)/${data.orderId}`);
        } else {
          router.push(`/(customer)/orders/${data.orderId}`);
        }
      }
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (!hydrated) return;
    const group = segments[0];
    const loggedIn = !!user && !!token;

    if (!loggedIn && group !== '(onboarding)') {
      router.replace('/(onboarding)/login');
      return;
    }
    if (loggedIn) {
      const expected =
        user!.role === 'VENDOR' ? '(vendor)' : user!.role === 'DELIVERY' ? '(rider)' : '(customer)';
      if (group !== expected) router.replace(expected === '(vendor)' ? '/(vendor)' : expected === '(rider)' ? '/(rider)' : '/(customer)/(tabs)');
    }
  }, [hydrated, user, token, segments]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(vendor)" />
      <Stack.Screen name="(rider)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigation />
    </SafeAreaProvider>
  );
}
