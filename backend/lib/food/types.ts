/**
 * Food Recognition Types
 *
 * These types define the shape of data returned by the food recognition service.
 */

/**
 * Food geometry category — discrete classification of how the food appears in the image.
 *
 * - "discrete_unit": Individual, countable items (banana, apple, egg)
 * - "amorphous_mound": Unstructured piles or collections (rice, lettuce, berries)
 * - "solid_slab": Contiguous, roughly planar shapes (steak, bread, fish fillet)
 * - "liquid_or_bowl": Liquids or foods in containers (soup, yogurt, sauce in a bowl)
 */
export type FoodGeometryCategory =
  | "discrete_unit"
  | "amorphous_mound"
  | "solid_slab"
  | "liquid_or_bowl";

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

  // ─── Geometry & Calibration Fields (Optional, for portion estimation) ───

  /**
   * Estimated mass in grams (if detectable from image and calibration).
   * Only present if reference calibration was available and successful.
   * This is a rough estimate, not a precise measurement.
   */
  estimatedGrams?: number;

  /**
   * Geometric category of how this food appears (e.g., discrete unit, mound, slab, liquid).
   * Used to apply appropriate portion estimation heuristics.
   */
  foodGeometryCategory?: FoodGeometryCategory;

  /**
   * Size tier classification relative to typical portions.
   * Examples: "tiny", "small", "medium", "large", "extra-large"
   */
  sizeTier?: string;

  /**
   * Visual height profile (e.g., "flat", "peaked", "rounded", "irregular").
   * Helps estimate volume for amorphous items.
   */
  heightProfile?: string;

  /**
   * Estimated number of discrete items (if geometry is "discrete_unit").
   * For continuous foods, this is typically 1 or null.
   */
  itemCount?: number;

  /**
   * Qualitative description of any visual scale cues detected (e.g., "ruler visible", "reference marker detected").
   * Indicates whether manual scale calibration was possible.
   */
  visualScaleCue?: string;

  /**
   * 2D bounding box of this food item in the image, normalized to 0–1000 scale.
   * Format: [ymin, xmin, ymax, xmax] (top, left, bottom, right).
   * Null if detection failed or geometry was not applicable.
   */
  box2d?: [number, number, number, number] | null;
}

/**
 * Detected reference marker in the image (optional).
 * Only present when a marker was successfully detected during calibration.
 */
export interface DetectedMarker {
  /** Type of marker detected (e.g., "credit_card", "us_quarter") */
  markerType: string;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** 2D bounding box normalized to 0–1000 scale: [ymin, xmin, ymax, xmax] */
  box2d?: [number, number, number, number] | null;
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

  /**
   * Optional detected reference marker (if calibration was enabled and marker was found).
   */
  detectedMarker?: DetectedMarker;
}

/**
 * Error types for food recognition failures.
 */
export type FoodRecognitionError =
  | { type: "invalid_image"; message: string }
  | { type: "api_error"; message: string; statusCode?: number }
  | { type: "validation_error"; message: string }
  | { type: "unknown_error"; message: string };
