/**
 * Scan Service — Handles food recognition network requests.
 *
 * Responsibilities:
 * 1. Validate local image file URIs before upload
 * 2. Upload food photos using Expo FileSystem multipart upload
 * 3. Handle network timeouts and connection errors
 * 4. Parse and return typed FoodRecognitionResult data
 *
 * ARCHITECTURAL NOTE:
 * This service lives purely in the mobile application layer. It interacts ONLY
 * with our own backend API and has ZERO knowledge of OmniRoute, Gemini, or any API keys.
 */

import * as FileSystem from 'expo-file-system/legacy';

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
 * Upload a food photo to the backend for AI recognition using native Expo FileSystem multipart upload.
 *
 * @param imageUri - The local file URI from expo-image-picker (e.g. "file:///...")
 * @returns FoodRecognitionResult with detected items and confidence scores
 */
export async function scanFoodImage(imageUri: string): Promise<FoodRecognitionResult> {
  if (!imageUri || typeof imageUri !== 'string' || imageUri.trim() === '') {
    throw new ScanServiceError('No image was provided for analysis.', 'MISSING_IMAGE_URI');
  }

  const endpoint = API_ENDPOINTS.scan;
  const baseUrl = getApiBaseUrl();

  // Validate local file existence before initiating the upload
  try {
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      throw new ScanServiceError(
        'The selected image file was not found on the device. Please select or capture another photo.',
        'FILE_NOT_FOUND'
      );
    }
  } catch (error) {
    if (error instanceof ScanServiceError) {
      throw error;
    }
    console.warn('[scan-service] FileSystem.getInfoAsync check warning:', error);
  }

  const { mimeType } = getImageMeta(imageUri);

  console.log(`[scan-service] Uploading food image to ${endpoint} (MIME: ${mimeType})`);

  try {
    const uploadResult = await FileSystem.uploadAsync(endpoint, imageUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'image',
      mimeType,
      headers: {
        Accept: 'application/json',
      },
    });

    console.log(`[scan-service] Backend responded with HTTP status ${uploadResult.status}`);

    let data: ScanApiResponse;
    try {
      data = JSON.parse(uploadResult.body);
    } catch {
      throw new ScanServiceError(
        `Server returned an invalid response (HTTP ${uploadResult.status}).`,
        'INVALID_RESPONSE'
      );
    }

    if (uploadResult.status < 200 || uploadResult.status >= 300 || !data.success) {
      const errorMessage =
        (!data.success && data.error?.message) ||
        `Server error occurred (HTTP ${uploadResult.status}).`;
      const errorCode = (!data.success && data.error?.code) || 'SERVER_ERROR';
      throw new ScanServiceError(errorMessage, errorCode);
    }

    return data.data;
  } catch (error) {
    if (error instanceof ScanServiceError) {
      throw error;
    }

    const rawMessage = error instanceof Error ? error.message : 'Unknown network failure';
    console.error('[scan-service] Upload failed:', error);

    throw new ScanServiceError(
      `Could not connect to NutriScan backend at ${baseUrl}.\n\n` +
      `Please ensure your phone and computer are on the same Wi-Fi network and the Next.js server is running on port 3001.\n\n` +
      `Details: ${rawMessage}`,
      'NETWORK_ERROR'
    );
  }
}
