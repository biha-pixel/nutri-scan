/**
 * API Configuration Constants
 *
 * Provides the base URL and endpoints for connecting to the NutriScan Next.js backend.
 *
 * HOW IT RESOLVES THE BASE URL:
 * 1. If EXPO_PUBLIC_API_URL is explicitly set in environment variables, use that.
 * 2. In development (__DEV__) on physical devices / Expo Go, automatically extract the host IP
 *    from Expo's runtime config (e.g., "192.168.1.28:8081" -> "http://192.168.1.28:3001").
 * 3. Fallback to "http://localhost:3001" for web / local simulator.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = 3001;

export function getApiBaseUrl(): string {
  // 1. Explicit environment variable (if set)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Physical device or simulator running via Expo Go in development
  if (__DEV__) {
    // hostUri typically looks like "192.168.1.28:8081" or "10.0.0.5:8081"
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
        ?.manifest2?.extra?.expoClient?.hostUri;

    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:${BACKEND_PORT}`;
      }
    }

    // Android emulator special loopback IP
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${BACKEND_PORT}`;
    }
  }

  // 3. Default fallback for Web or iOS Simulator
  return `http://localhost:${BACKEND_PORT}`;
}

export const API_ENDPOINTS = {
  get scan() {
    return `${getApiBaseUrl()}/api/scan`;
  },
} as const;
