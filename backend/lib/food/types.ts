/**
 * Food Recognition Types
 *
 * These types define the shape of data returned by the food recognition service.
 */

/**
 * A single food item detected in an image.
 */
export interface FoodItem {
  /**
   * Common name of the food (e.g., "banana", "chicken breast")
   */
  name: string;

  /**
   * Canonical name used for nutrition lookup (e.g., "Bananas, raw")
   * This may differ from the display name.
   */
  canonicalName: string;

  /**
   * Confidence score between 0 and 1.
   * - 0.9–1.0: Very confident
   * - 0.7–0.9: Confident
   * - 0.5–0.7: Uncertain, should ask user to verify
   * - < 0.5: Very uncertain, likely incorrect
   */
  confidence: number;

  /**
   * Brief description of the item (e.g., "ripe yellow banana", "grilled chicken breast")
   */
  description: string;

  /**
   * Estimated portion or quantity category (e.g., "1 medium", "100g", "1 cup")
   * This is an ESTIMATE only — not a precise measurement.
   */
  estimatedPortion: string;
}

/**
 * Result of analyzing a food image.
 */
export interface FoodRecognitionResult {
  /**
   * List of food items detected in the image.
   * Empty array if no food was detected.
   */
  items: FoodItem[];

  /**
   * Overall image quality assessment.
   * - "good": Image is clear and well-lit
   * - "poor": Image is blurry, dark, or partially obscured
   * - "unrecognizable": Cannot identify any food in the image
   */
  imageQuality: "good" | "poor" | "unrecognizable";

  /**
   * Optional message explaining issues with the image or recognition.
   * Example: "Image is too dark to identify food clearly"
   */
  message?: string;
}

/**
 * Error types for food recognition failures.
 */
export type FoodRecognitionError =
  | { type: "invalid_image"; message: string }
  | { type: "api_error"; message: string; statusCode?: number }
  | { type: "validation_error"; message: string }
  | { type: "unknown_error"; message: string };
