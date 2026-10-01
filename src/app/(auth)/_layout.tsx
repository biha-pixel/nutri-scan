/**
 * Auth Group Layout
 *
 * This is the layout for the authentication screens (sign-in, sign-up).
 *
 * WHY A SEPARATE GROUP?
 * Expo Router uses "groups" — folders wrapped in parentheses like (auth) —
 * to organize routes without affecting the URL. The (auth) group contains
 * screens for sign-in and sign-up, which share a common layout (a simple
 * Stack with no tab bar). This keeps auth screens visually separate from
 * the main tabbed app.
 *
 * The parentheses mean "(auth)" does NOT appear in the URL.
 * The sign-in screen is at /sign-in, not /auth/sign-in.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Prevent swiping back from sign-up to sign-in unexpectedly
        gestureEnabled: false,
      }}
    />
  );
}
