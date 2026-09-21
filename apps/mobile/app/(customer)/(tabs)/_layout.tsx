import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../../src/theme/tokens';

function Icon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function CustomerTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: () => <Icon emoji="🏠" /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: () => <Icon emoji="🔍" /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: () => <Icon emoji="🧾" /> }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites', tabBarIcon: () => <Icon emoji="❤️" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <Icon emoji="👤" /> }} />
    </Tabs>
  );
}
