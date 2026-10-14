/**
 * Food Analysis Service
 *
 * Handles the unified food analysis flow: uploads an image to POST /api/analyze-food
 * and receives back full nutrition data, highlights, and structured status per item.
 *
 * RESPONSIBILITY:
 * - Validates local image file before upload
 * - Constructs multipart/form-data request
 * - Provides progress callbacks for each of the 4 stages:
 *   1. "preparing" — Validating image locally
 *   2. "analyzing" — AI vision service identifying food
 *   3. "nutrition" — Looking up nutrition data from USDA
 *   4. "finalizing" — Generating educational highlights
 * - Parses and validates API response
 * - Throws typed errors for network, validation, and API failures
 *
 * USAGE:
 * ```typescript
 * import { analyzeFoodImage } from '@/services/analyze-service';
 *
 * const result = await analyzeFoodImage(imageUri, (stage) => {
 *   console.log(`Progress: ${stage}`);
 * });
 * ```
 */

import { Platform } from 'react-native';
import { File, UploadType, Paths } from 'expo-file-system';
import { API_ENDPOINTS } from '@/constants/api';
import type {
  FoodAnalysisResult,
  AnalyzeFoodApiResponse,
  AnalysisLoadingStage,
} from '@/types/food';

export class AnalyzeServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AnalyzeServiceError';
  }
}

/**
 * Progress callback invoked at each stage of the analysis pipeline.
 * Enables the UI to display granular loading states to the user.
 */
export type AnalysisProgressCallback = (stage: AnalysisLoadingStage) => void;

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
 * Analyze a food image and retrieve full nutrition data + highlights.
 *
 * STAGES:
 * 1. "preparing" — Local validation (file exists, MIME type inference)
 * 2. "analyzing" — Backend vision service identifies food items
 * 3. "nutrition" — Backend looks up USDA nutrition data per item
 * 4. "finalizing" — Backend generates rule-based educational highlights
 *
 * @param imageUri — Local file URI (e.g., from ImagePicker)
 * @param onProgress — Optional callback invoked at each stage
 * @returns FoodAnalysisResult with analyzed items, nutrition, and highlights
 * @throws AnalyzeServiceError on validation, network, or API errors
 */
export async function analyzeFoodImage(
  imageUri: string,
  onProgress?: AnalysisProgressCallback
): Promise<FoodAnalysisResult> {
  let tempUploadFile: File | null = null;

  try {
    // Stage 1: Preparing — Local validation
    onProgress?.('preparing');

    if (!imageUri || typeof imageUri !== 'string' || imageUri.trim() === '') {
      throw new AnalyzeServiceError(
        'No image was provided for analysis.',
        'MISSING_IMAGE_URI'
      );
    }

    if (Platform.OS === 'web') {
      const { fileName, mimeType } = getImageMeta(imageUri);
      console.log(`[analyze-service] [1/5] Image URI: ${imageUri} (Web)`);

      const blobResponse = await fetch(imageUri);
      const blob = await blobResponse.blob();

      const formData = new FormData();
      const fileBlob = blob.type ? blob : new Blob([blob], { type: mimeType });
      formData.append('image', fileBlob, fileName);

      console.log(`[analyze-service] [3/5] Starting web upload to: ${API_ENDPOINTS.analyzeFood}`);
      onProgress?.('analyzing');

      const uploadResult = await fetch(API_ENDPOINTS.analyzeFood, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });

      console.log(`[analyze-service] [4/5] Upload completed with HTTP status: ${uploadResult.status}`);

      if (!uploadResult.ok) {
        const errorText = await uploadResult.text().catch(() => '');
        throw new AnalyzeServiceError(
          `Server returned status ${uploadResult.status}. Please try again.`,
          'HTTP_ERROR',
          { status: uploadResult.status, body: errorText }
        );
      }

      onProgress?.('nutrition');
      onProgress?.('finalizing');

      const responseData: AnalyzeFoodApiResponse = await uploadResult.json();
      console.log(`[analyze-service] [5/5] Backend parsed response success: ${responseData.success}`);

      if (!responseData.success) {
        throw new AnalyzeServiceError(
          responseData.error.message,
          responseData.error.code,
          responseData.error
        );
      }
      return responseData.data;
    }

    const normalizedUri = normalizeFileUri(imageUri);
    const sourceFile = new File(normalizedUri);
    const { fileName, mimeType } = getImageMeta(imageUri);

    console.log(`[analyze-service] [1/5] Image URI: ${imageUri} (Normalized: ${normalizedUri})`);
    console.log(`[analyze-service] [2/5] File details: Name=${fileName}, Exists=${sourceFile.exists}, Size=${sourceFile.size}B, MIME=${mimeType}`);

    // Create a temporary copy in application cache directory to guarantee readable permissions in Expo Go
    const tempFileName = `upload_${Date.now()}_${fileName}`;
    tempUploadFile = new File(Paths.cache, tempFileName);
    await sourceFile.copy(tempUploadFile, { overwrite: true });

    // Stage 2: Analyzing — Upload image and wait for AI recognition
    onProgress?.('analyzing');

    console.log(`[analyze-service] [3/5] Starting native upload to: ${API_ENDPOINTS.analyzeFood}`);

    const uploadResult = await tempUploadFile.upload(API_ENDPOINTS.analyzeFood, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'image',
      mimeType,
      headers: {
        Accept: 'application/json',
      },
    });

    console.log(`[analyze-service] [4/5] Upload completed with HTTP status: ${uploadResult.status}`);

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      throw new AnalyzeServiceError(
        `Server returned status ${uploadResult.status}. Please try again.`,
        'HTTP_ERROR',
        { status: uploadResult.status, body: uploadResult.body }
      );
    }

    // Stage 3 & 4: Nutrition + Finalizing happen on backend
    // The backend orchestrates these internally, but we surface them to the user
    // via the progress callback to communicate what's happening behind the scenes.
    onProgress?.('nutrition');
    // Immediate transition to finalizing since backend returns the complete result
    onProgress?.('finalizing');

    // Parse and validate response
    const responseData: AnalyzeFoodApiResponse = JSON.parse(uploadResult.body);

    console.log(`[analyze-service] [5/5] Backend parsed response success: ${responseData.success}`);

    if (!responseData.success) {
      throw new AnalyzeServiceError(
        responseData.error.message,
        responseData.error.code,
        responseData.error
      );
    }

    return responseData.data;
  } catch (error) {
    // Re-throw AnalyzeServiceError as-is
    if (error instanceof AnalyzeServiceError) {
      throw error;
    }

    // Network / fetch errors
    if (error instanceof Error) {
      if (error.message.includes('Network request failed')) {
        throw new AnalyzeServiceError(
          'Could not connect to the server. Check your internet connection and try again.',
          'NETWORK_ERROR',
          error
        );
      }

      if (error.message.includes('timeout')) {
        throw new AnalyzeServiceError(
          'The request took too long. Please try again with a smaller image or better connection.',
          'TIMEOUT',
          error
        );
      }

      // JSON parse errors
      if (error.message.includes('JSON')) {
        throw new AnalyzeServiceError(
          'Received an invalid response from the server. Please try again.',
          'INVALID_RESPONSE',
          error
        );
      }

      // Generic error fallback
      throw new AnalyzeServiceError(
        `Analysis failed: ${error.message}`,
        'UNKNOWN_ERROR',
        error
      );
    }

    // Non-Error thrown (shouldn't happen, but TypeScript requires handling)
    throw new AnalyzeServiceError(
      'An unexpected error occurred during analysis.',
      'UNKNOWN_ERROR',
      error
    );
  } finally {
    if (tempUploadFile && tempUploadFile.exists) {
      try {
        tempUploadFile.delete();
      } catch (cleanupError) {
        console.warn('[analyze-service] Failed to clean up temp upload file:', cleanupError);
      }
    }
  }
}

/**
 * Infer MIME type from file URI extension.
 * Defaults to 'image/jpeg' to prevent valid uploads from being rejected due to missing extensions.
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
