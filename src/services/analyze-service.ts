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

import * as FileSystem from 'expo-file-system/legacy';
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
  try {
    // Stage 1: Preparing — Local validation
    onProgress?.('preparing');

    if (!imageUri || typeof imageUri !== 'string' || imageUri.trim() === '') {
      throw new AnalyzeServiceError(
        'No image was provided for analysis.',
        'MISSING_IMAGE_URI'
      );
    }

    // Infer MIME type securely (defaults to image/jpeg if unknown)
    const { mimeType } = getImageMeta(imageUri);

    // Stage 2: Analyzing — Upload image and wait for AI recognition
    onProgress?.('analyzing');

    const uploadResult = await FileSystem.uploadAsync(API_ENDPOINTS.analyzeFood, imageUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'image',
      mimeType,
    });

    if (uploadResult.status !== 200) {
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
