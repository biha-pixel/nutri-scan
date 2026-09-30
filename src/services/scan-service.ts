/**
 * Scan Service — Handles food recognition network requests.
 *
 * Responsibilities:
 * 1. Prepare image files as multipart/form-data payloads
 * 2. Send requests to the Next.js /api/scan endpoint
 * 3. Handle network timeouts and connection errors
 * 4. Parse and return typed FoodRecognitionResult data
 *
 * ARCHITECTURAL NOTE:
 * This service lives purely in the mobile application layer. It interacts ONLY
 * with our own backend API and has ZERO knowledge of OmniRoute, Gemini, or any API keys.
 */

import { API_ENDPOINTS, getApiBaseUrl } from '@/constants/api';
import type { FoodRecognitionResult, ScanApiResponse } from '@/types/food';

export class ScanServiceError extends Error {
  code: string;

  constructor(message: string, code: string = 'SCAN_ERROR') {
    super(message);
    this.name = 'ScanServiceError';
    this.code = code;
  }
}

/**
 * Infer file name and MIME type from a local image URI.
 */
function getImageMeta(uri: string): { fileName: string; mimeType: string } {
  const cleanUri = uri.split('?')[0].split('#')[0];
  const extension = cleanUri.split('.').pop()?.toLowerCase() || 'jpg';

  let mimeType = 'image/jpeg';
  let validExt = 'jpg';

  if (extension === 'png') {
    mimeType = 'image/png';
    validExt = 'png';
  } else if (extension === 'webp') {
    mimeType = 'image/webp';
    validExt = 'webp';
  } else if (extension === 'heic') {
    mimeType = 'image/heic';
    validExt = 'heic';
  } else if (extension === 'jpeg' || extension === 'jpg') {
    mimeType = 'image/jpeg';
    validExt = 'jpg';
  }

  const rawFileName = cleanUri.split('/').pop() || `food-photo.${validExt}`;
  const fileName = rawFileName.includes('.') ? rawFileName : `${rawFileName}.${validExt}`;

  return { fileName, mimeType };
}

/**
 * Upload a food photo to the backend for AI recognition.
 *
 * @param imageUri - The local file URI from expo-image-picker (e.g. "file:///...")
 * @returns FoodRecognitionResult with detected items and confidence scores
 */
export async function scanFoodImage(imageUri: string): Promise<FoodRecognitionResult> {
  const { fileName, mimeType } = getImageMeta(imageUri);

  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const endpoint = API_ENDPOINTS.scan;
  const baseUrl = getApiBaseUrl();

  // 45-second timeout to allow for multi-model retry on the backend
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    const data: ScanApiResponse = await response.json().catch(() => {
      throw new ScanServiceError(
        `Server returned an invalid response (HTTP ${response.status}).`,
        'INVALID_RESPONSE'
      );
    });

    if (!response.ok || !data.success) {
      const errorMessage =
        (!data.success && data.error?.message) ||
        `Server error occurred (HTTP ${response.status}).`;
      const errorCode = (!data.success && data.error?.code) || 'SERVER_ERROR';
      throw new ScanServiceError(errorMessage, errorCode);
    }

    return data.data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ScanServiceError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ScanServiceError(
        'The food analysis request timed out. Please check your network connection and try again.',
        'TIMEOUT'
      );
    }

    // Network connectivity error
    const rawMessage = error instanceof Error ? error.message : 'Unknown network failure';
    throw new ScanServiceError(
      `Could not connect to NutriScan backend at ${baseUrl}.\n\n` +
      `Please ensure your phone and computer are on the same Wi-Fi network and the Next.js server is running on port 3001.\n\n` +
      `Details: ${rawMessage}`,
      'NETWORK_ERROR'
    );
  }
}
