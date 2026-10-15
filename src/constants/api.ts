/**
 * API Configuration Constants
 *
 * Provides the base URL and endpoints for connecting to the NutriScan Next.js backend.
 *
 * HOW IT RESOLVES THE BASE URL:
 * 1. Web (Platform.OS === 'web'): Uses EXPO_PUBLIC_WEB_API_URL or defaults to "http://localhost:3001".
 * 2. Native (iOS / Android):
 *    a. If EXPO_PUBLIC_API_URL is explicitly set in environment variables, use that.
 *    b. In development (__DEV__) on physical devices / Expo Go, automatically extract the host IP
 *       from Expo's runtime config (e.g., "192.168.1.28:8081" -> "http://192.168.1.28:3001").
 *    c. Android emulator fallback to "http://10.0.2.2:3001".
 *    d. Fallback to "http://localhost:3001".
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = 3001;

export function getApiBaseUrl(): string {
  // 1. Web environment: dedicated browser backend URL or localhost
  if (Platform.OS === 'web') {
    return process.env.EXPO_PUBLIC_WEB_API_URL || `http://localhost:${BACKEND_PORT}`;
  }

  // 2. Native mobile: explicit environment variable (if set)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 3. Physical device or simulator running via Expo Go in development
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

  // 4. Default fallback for iOS Simulator
  return `http://localhost:${BACKEND_PORT}`;
}

export const API_ENDPOINTS = {
  get scan() {
    return `${getApiBaseUrl()}/api/scan`;
  },
  get analyzeFood() {
    return `${getApiBaseUrl()}/api/analyze-food`;
  },
  get scans() {
    return `${getApiBaseUrl()}/api/scans`;
  },
  scanById(id: string) {
    return `${getApiBaseUrl()}/api/scans/${id}`;
  },
} as const;
