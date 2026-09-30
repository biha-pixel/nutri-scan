/**
 * Food Recognition Types (Mobile Client)
 *
 * These types define the contract between the mobile frontend
 * and the Next.js backend API for food analysis.
 */

/**
 * A single food item identified by the vision service.
 */
export interface FoodItem {
  /** Display name of the food (e.g., "Banana", "Grilled Chicken") */
  name: string;
  /** Standardized name used for nutritional database lookup (e.g., "Bananas, raw") */
  canonicalName: string;
  /** AI confidence score between 0.0 and 1.0 */
  confidence: number;
  /** Brief description of the item observed in the image */
  description: string;
  /** Rough portion estimate (e.g., "1 medium", "100g", "1 cup") */
  estimatedPortion: string;
}

/**
 * Result returned by the food recognition API endpoint (/api/scan).
 */
export interface FoodRecognitionResult {
  /** Array of identified food items */
  items: FoodItem[];
  /** Overall quality rating of the analyzed image */
  imageQuality: 'good' | 'poor' | 'unrecognizable';
  /** Optional message or notes from the vision service */
  message?: string;
}

/**
 * Standard API error response format.
 */
export interface ApiError {
  code: string;
  message: string;
}

/**
 * Full backend response structure for POST /api/scan.
 */
export type ScanApiResponse =
  | { success: true; data: FoodRecognitionResult }
  | { success: false; error: ApiError };
