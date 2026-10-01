/**
 * Supabase Client Configuration
 *
 * Configures the Supabase JavaScript client for React Native with:
 * - AsyncStorage for session persistence across app restarts
 * - Auto-refresh for access tokens
 * - AppState listener that refreshes tokens when the app comes to foreground
 *
 * WHY AppState MATTERS:
 * When a mobile app is backgrounded (user switches to another app), the
 * auto-refresh timer stops running. When the user comes back, the access
 * token might have expired. The AppState listener detects this "return to
 * foreground" and immediately tells Supabase to check the session and
 * refresh the token if needed. Without this, users would be randomly
 * logged out after switching apps.
 *
 * SECURITY:
 * - The anon key is safe for client-side use because Row Level Security (RLS)
 *   enforces all authorization checks at the database level.
 * - NEVER put the service_role key here — it bypasses RLS.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// Supabase configuration
// Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Store session tokens in AsyncStorage so they survive app restarts
    storage: AsyncStorage,
    // Automatically refresh the access token before it expires
    autoRefreshToken: true,
    // Persist the session (tokens) across app restarts
    persistSession: true,
    // React Native doesn't use URLs for auth callbacks, so disable URL detection
    detectSessionInUrl: false,
  },
});

/**
 * AppState listener for token refresh.
 *
 * When the app transitions from background → foreground ("active"),
 * Supabase checks if the stored session is still valid. If the access
 * token expired while the app was backgrounded, Supabase uses the
 * refresh token to get a new access token automatically.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
