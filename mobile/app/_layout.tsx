import React from 'react';
import { Stack } from 'expo-router';
import { COLORS } from '../constants/theme';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.card,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'NutriScan',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="result"
        options={{
          title: 'Nutrition Result',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="history"
        options={{
          title: 'Scan History',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Stack>
  );
}
