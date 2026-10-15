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

import { Platform } from 'react-native';
import { File, UploadType, Paths } from 'expo-file-system';

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
 * Normalizes Android local file URIs for Expo Go experience directory paths.
 * On Android ext4 filesystems, experience directories contain literal `%40` and `%2F`.
 * Native Java URI.create() unescapes `%2F` into `/`, causing "File does not exist" errors
 * unless percent signs are escaped (`%` -> `%25`).
 */
function normalizeFileUri(uri: string): string {
  if (Platform.OS === 'android' && uri.startsWith('file://')) {
    if (uri.includes('%') && !uri.includes('%25')) {
      return uri.replace(/%/g, '%25');
    }
  }
  return uri;
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

  if (Platform.OS === 'web') {
    const { fileName, mimeType } = getImageMeta(imageUri);
    console.log(`[scan-service] [1/5] Image URI: ${imageUri} (Web)`);

    try {
      const blobResponse = await fetch(imageUri);
      const blob = await blobResponse.blob();

      const formData = new FormData();
      const fileBlob = blob.type ? blob : new Blob([blob], { type: mimeType });
      formData.append('image', fileBlob, fileName);

      console.log(`[scan-service] [3/5] Starting web upload to: ${endpoint}`);

      const uploadResult = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });

      console.log(`[scan-service] [4/5] Upload completed with HTTP status: ${uploadResult.status}`);

      let data: ScanApiResponse;
      try {
        data = await uploadResult.json();
      } catch {
        throw new ScanServiceError(
          `Server returned an invalid response (HTTP ${uploadResult.status}).`,
          'INVALID_RESPONSE'
        );
      }

      console.log(`[scan-service] [5/5] Backend parsed response success: ${data.success}`);

      if (!uploadResult.ok || !data.success) {
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
        `Details: ${rawMessage}`,
        'NETWORK_ERROR'
      );
    }
  }

  const normalizedUri = normalizeFileUri(imageUri);
  const sourceFile = new File(normalizedUri);
  const { fileName, mimeType } = getImageMeta(imageUri);

  console.log(`[scan-service] [1/5] Image URI: ${imageUri} (Normalized: ${normalizedUri})`);
  console.log(`[scan-service] [2/5] File details: Name=${fileName}, Exists=${sourceFile.exists}, Size=${sourceFile.size}B, MIME=${mimeType}`);

  let tempUploadFile: File | null = null;

  try {
    const tempFileName = `upload_${Date.now()}_${fileName}`;
    tempUploadFile = new File(Paths.cache, tempFileName);
    await sourceFile.copy(tempUploadFile, { overwrite: true });

    console.log(`[scan-service] [3/5] Starting native upload to: ${endpoint}`);

    const uploadResult = await tempUploadFile.upload(endpoint, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'image',
      mimeType,
      headers: {
        Accept: 'application/json',
      },
    });

    console.log(`[scan-service] [4/5] Upload completed with HTTP status: ${uploadResult.status}`);

    let data: ScanApiResponse;
    try {
      data = JSON.parse(uploadResult.body);
    } catch {
      throw new ScanServiceError(
        `Server returned an invalid response (HTTP ${uploadResult.status}).`,
        'INVALID_RESPONSE'
      );
    }

    console.log(`[scan-service] [5/5] Backend parsed response success: ${data.success}`);

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
  } finally {
    if (tempUploadFile && tempUploadFile.exists) {
      try {
        tempUploadFile.delete();
      } catch (cleanupError) {
        console.warn('[scan-service] Failed to clean up temp upload file:', cleanupError);
      }
    }
  }
}
