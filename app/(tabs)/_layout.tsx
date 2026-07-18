import { Stack } from 'expo-router';
import React from 'react';

export default function GameLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="menu" />
      <Stack.Screen name="game" options={{ animation: 'none', gestureEnabled: false }} />
      <Stack.Screen name="game-over" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="character-select" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="shop" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="daily-reward" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="snake-shift" options={{ animation: 'none', gestureEnabled: false }} />
      <Stack.Screen name="shape-merge-levels" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="shape-merge" options={{ animation: 'none', gestureEnabled: false }} />
      <Stack.Screen name="bubble-shooter" options={{ animation: 'none', gestureEnabled: false }} />
    </Stack>
  );
}
