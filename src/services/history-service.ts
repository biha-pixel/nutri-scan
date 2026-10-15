/**
 * History Service — Handles scan persistence and history retrieval.
 *
 * Responsibilities:
 * 1. Fetch paginated scan history for the authenticated user from GET /api/scans
 * 2. Save newly analyzed food scans via POST /api/scans
 * 3. Fetch single scan details via GET /api/scans/[id]
 * 4. Delete scans via DELETE /api/scans/[id]
 * 5. Convert FoodAnalysisResult domain models into CreateScanPayload for persistence
 *
 * SECURITY NOTE:
 * JWT access tokens are forwarded in the `Authorization: Bearer <token>` header.
 * The backend verifies this token with Supabase Auth and enforces Row Level Security (RLS)
 * so that users can strictly read, create, and delete their own scan history.
 */

import { API_ENDPOINTS, getApiBaseUrl } from '@/constants/api';
import type {
  CreateScanPayload,
  DeleteScanApiResponse,
  FoodAnalysisResult,
  SavedScan,
  SavedScanApiResponse,
  ScanHistoryApiResponse,
  ScanHistoryData,
  NutritionData,
} from '@/types/food';

export class HistoryServiceError extends Error {
  code: string;

  constructor(message: string, code: string = 'HISTORY_ERROR') {
    super(message);
    this.name = 'HistoryServiceError';
    this.code = code;
  }
}

interface FetchHistoryOptions {
  token?: string | null;
  limit?: number;
  offset?: number;
}

/**
 * Fetch paginated food scan history for the current authenticated user.
 */
export async function fetchScanHistory(options: FetchHistoryOptions = {}): Promise<ScanHistoryData> {
  const { token, limit = 20, offset = 0 } = options;
  const baseUrl = API_ENDPOINTS.scans;
  const url = `${baseUrl}?limit=${limit}&offset=${offset}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const json: ScanHistoryApiResponse = await response.json();

    if (!response.ok || !json.success) {
      const message = (!json.success && json.error?.message) || `Failed to fetch history (HTTP ${response.status})`;
      const code = (!json.success && json.error?.code) || 'FETCH_ERROR';
      throw new HistoryServiceError(message, code);
    }

    return json.data;
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      throw error;
    }
    const rawMessage = error instanceof Error ? error.message : 'Unknown network failure';
    throw new HistoryServiceError(
      `Could not connect to NutriScan backend at ${getApiBaseUrl()}.\n\nDetails: ${rawMessage}`,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Save a newly completed food scan to the database.
 */
export async function saveScanRecord(
  payload: CreateScanPayload,
  token?: string | null
): Promise<SavedScan> {
  const url = API_ENDPOINTS.scans;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const json: SavedScanApiResponse = await response.json();

    if (!response.ok || !json.success) {
      const message = (!json.success && json.error?.message) || `Failed to save scan (HTTP ${response.status})`;
      const code = (!json.success && json.error?.code) || 'SAVE_ERROR';
      throw new HistoryServiceError(message, code);
    }

    return json.data;
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      throw error;
    }
    const rawMessage = error instanceof Error ? error.message : 'Unknown network failure';
    throw new HistoryServiceError(
      `Failed to save scan to database.\n\nDetails: ${rawMessage}`,
      'SAVE_ERROR'
    );
  }
}

/**
 * Fetch a specific scan record by its UUID.
 */
export async function fetchScanById(id: string, token?: string | null): Promise<SavedScan> {
  const url = API_ENDPOINTS.scanById(id);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const json: SavedScanApiResponse = await response.json();

    if (!response.ok || !json.success) {
      const message = (!json.success && json.error?.message) || `Scan not found (HTTP ${response.status})`;
      const code = (!json.success && json.error?.code) || 'NOT_FOUND';
      throw new HistoryServiceError(message, code);
    }

    return json.data;
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      throw error;
    }
    const rawMessage = error instanceof Error ? error.message : 'Unknown network failure';
    throw new HistoryServiceError(
      `Failed to retrieve scan details.\n\nDetails: ${rawMessage}`,
      'FETCH_ERROR'
    );
  }
}

/**
 * Delete a scan record by its UUID.
 */
export async function deleteScanRecord(id: string, token?: string | null): Promise<boolean> {
  const url = API_ENDPOINTS.scanById(id);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    const json: DeleteScanApiResponse = await response.json();

    if (!response.ok || !json.success) {
      const message = (!json.success && json.error?.message) || `Failed to delete scan (HTTP ${response.status})`;
      const code = (!json.success && json.error?.code) || 'DELETE_ERROR';
      throw new HistoryServiceError(message, code);
    }

    return json.data.deleted;
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      throw error;
    }
    const rawMessage = error instanceof Error ? error.message : 'Unknown network failure';
    throw new HistoryServiceError(
      `Failed to delete scan record.\n\nDetails: ${rawMessage}`,
      'DELETE_ERROR'
    );
  }
}

/**
 * Utility helper to convert a FoodAnalysisResult into a CreateScanPayload ready for backend saving.
 * Optionally applies user-adjusted portion sizes to scale nutrition values before saving.
 */
export function formatAnalysisResultForSave(
  result: FoodAnalysisResult,
  userId?: string | null,
  imageUrl?: string | null,
  adjustedPortions?: { [itemIndex: number]: number }
): CreateScanPayload {
  // Helper function to scale nutrition to adjusted portion size
  const scaleNutritionForPortions = (nutrition: NutritionData, targetGrams: number) => {
    const baseSizeGrams = nutrition.servingSize || 100;
    const scaleFactor = targetGrams / baseSizeGrams;

    return {
      ...nutrition,
      servingSize: targetGrams,
      calories: nutrition.calories ? Math.round(nutrition.calories * scaleFactor) : null,
      macronutrients: {
        protein: nutrition.macronutrients.protein
          ? Math.round(nutrition.macronutrients.protein * scaleFactor * 10) / 10
          : null,
        totalFat: nutrition.macronutrients.totalFat
          ? Math.round(nutrition.macronutrients.totalFat * scaleFactor * 10) / 10
          : null,
        saturatedFat: nutrition.macronutrients.saturatedFat
          ? Math.round(nutrition.macronutrients.saturatedFat * scaleFactor * 10) / 10
          : null,
        carbohydrates: nutrition.macronutrients.carbohydrates
          ? Math.round(nutrition.macronutrients.carbohydrates * scaleFactor * 10) / 10
          : null,
        fiber: nutrition.macronutrients.fiber
          ? Math.round(nutrition.macronutrients.fiber * scaleFactor * 10) / 10
          : null,
        sugar: nutrition.macronutrients.sugar
          ? Math.round(nutrition.macronutrients.sugar * scaleFactor * 10) / 10
          : null,
      },
      micronutrients: {
        sodium: nutrition.micronutrients.sodium
          ? Math.round(nutrition.micronutrients.sodium * scaleFactor * 10) / 10
          : null,
        cholesterol: nutrition.micronutrients.cholesterol
          ? Math.round(nutrition.micronutrients.cholesterol * scaleFactor * 10) / 10
          : null,
        potassium: nutrition.micronutrients.potassium
          ? Math.round(nutrition.micronutrients.potassium * scaleFactor * 10) / 10
          : null,
        vitaminA: nutrition.micronutrients.vitaminA
          ? Math.round(nutrition.micronutrients.vitaminA * scaleFactor * 10) / 10
          : null,
        vitaminC: nutrition.micronutrients.vitaminC
          ? Math.round(nutrition.micronutrients.vitaminC * scaleFactor * 10) / 10
          : null,
        calcium: nutrition.micronutrients.calcium
          ? Math.round(nutrition.micronutrients.calcium * scaleFactor * 10) / 10
          : null,
        iron: nutrition.micronutrients.iron
          ? Math.round(nutrition.micronutrients.iron * scaleFactor * 10) / 10
          : null,
      },
    };
  };

  return {
    userId: userId || null,
    imageUrl: imageUrl || null,
    items: result.items.map((item, itemIndex) => {
      // Check if user adjusted this item's portion
      const adjustedGrams = adjustedPortions?.[itemIndex];
      const nutritionToSave = adjustedGrams && item.nutrition
        ? scaleNutritionForPortions(item.nutrition, adjustedGrams)
        : item.nutrition;

      return {
        foodName: item.name,
        confidence: item.confidence,
        nutritionSource: nutritionToSave?.source ?? 'usda_fdc',
        nutritionId: nutritionToSave?.sourceId ?? null,
        servingBasis:
          adjustedGrams ? `${adjustedGrams}g (user-adjusted)` :
          item.estimatedPortion ||
          (nutritionToSave ? `${nutritionToSave.servingSize}${nutritionToSave.servingUnit}` : '100g'),
        nutrients: {
          calories: nutritionToSave?.calories ?? null,
          macronutrients: nutritionToSave?.macronutrients,
          micronutrients: nutritionToSave?.micronutrients,
        },
        highlights: item.highlights ?? [],
      };
    }),
  };
}
