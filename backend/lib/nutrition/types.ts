/**
 * Nutrition Lookup Types
 *
 * These types define the shape of data in the nutrition lookup system.
 *
 * KEY DESIGN DECISION:
 * Nutrition values come from authoritative data sources (USDA, Open Food Facts),
 * NEVER from the AI model. The AI identifies food; these types represent
 * what we get from the nutrition database.
 *
 * KEY RULE FOR UNKNOWN VALUES:
 * When a nutrient value is not available from the data source, we use
 * `null` (not `0`). Zero means "this food contains none of this nutrient,"
 * which is a meaningful claim. Null means "we don't know."
 * Example: If USDA doesn't report Vitamin A for a food, we store `null`,
 * not `0`. Showing "Vitamin A: 0mg" would be misleading.
 */

// ─── Normalized Nutrition Data (Our Internal Format) ───────────────

/**
 * Macronutrient values for a food item.
 *
 * "Macronutrients" are nutrients your body needs in large amounts:
 * protein, fat, and carbohydrates. They provide calories (energy).
 *
 * All values are in grams per serving.
 * `null` means "data not available" — NOT "zero."
 */
export interface Macronutrients {
  /** Grams of protein per serving */
  protein: number | null;
  /** Grams of total fat per serving */
  totalFat: number | null;
  /** Grams of saturated fat per serving (a subset of totalFat) */
  saturatedFat: number | null;
  /** Grams of total carbohydrates per serving */
  carbohydrates: number | null;
  /** Grams of dietary fiber per serving (a subset of carbohydrates) */
  fiber: number | null;
  /** Grams of total sugars per serving (a subset of carbohydrates) */
  sugar: number | null;
}

/**
 * Micronutrient values for a food item.
 *
 * "Micronutrients" are nutrients your body needs in small amounts:
 * vitamins and minerals. They don't provide calories but are essential
 * for body functions.
 *
 * Units vary per nutrient (noted in comments).
 * `null` means "data not available."
 */
export interface Micronutrients {
  /** Milligrams of sodium per serving */
  sodium: number | null;
  /** Milligrams of cholesterol per serving */
  cholesterol: number | null;
  /** Milligrams of potassium per serving */
  potassium: number | null;
  /** Micrograms of Vitamin A (RAE) per serving */
  vitaminA: number | null;
  /** Milligrams of Vitamin C per serving */
  vitaminC: number | null;
  /** Milligrams of calcium per serving */
  calcium: number | null;
  /** Milligrams of iron per serving */
  iron: number | null;
}

/**
 * Complete normalized nutrition data for a single food item.
 *
 * This is our INTERNAL format — every nutrition provider (USDA, Open Food Facts,
 * a future custom database) must convert their response into this shape.
 *
 * The mobile app receives this format. It never sees raw USDA or Open Food Facts data.
 */
export interface NutritionData {
  /** Human-readable food name (e.g., "Chicken breast, roasted") */
  foodName: string;

  /** Which data source this came from (e.g., "usda_fdc", "open_food_facts") */
  source: string;

  /** The food's ID in the data source (e.g., USDA FDC ID "171077") */
  sourceId: string;

  /** Serving size amount (e.g., 100, 1) */
  servingSize: number;

  /** Serving size unit (e.g., "g", "oz", "cup", "medium") */
  servingUnit: string;

  /** Kilocalories per serving. `null` if not available. */
  calories: number | null;

  /** Macronutrient breakdown */
  macronutrients: Macronutrients;

  /** Micronutrient breakdown (vitamins and minerals) */
  micronutrients: Micronutrients;

  /** URL to view this food on the data source's website, if available */
  sourceUrl: string | null;

  /** How well this matched the search query */
  matchConfidence: "exact" | "close" | "approximate";
}

// ─── Search Results ────────────────────────────────────────────────

/**
 * A single search result returned when looking up a food name.
 *
 * When we search USDA for "chicken breast", we might get 25 results.
 * Each result is a NutritionSearchResult — a summary with enough info
 * to decide which one to pick, but not the full nutrition details.
 */
export interface NutritionSearchResult {
  /** The food's ID in the data source */
  sourceId: string;

  /** Which data source this result came from */
  source: string;

  /** The food's name as listed in the data source */
  foodName: string;

  /** Brief additional description if available (e.g., brand name, preparation) */
  description: string | null;

  /** The category or data type (e.g., "Foundation", "SR Legacy", "Branded") */
  dataType: string | null;

  /**
   * A relevance/quality score from 0 to 1 indicating how well this
   * matched the search query. Used for ranking results.
   */
  score: number;
}

// ─── Error Types ───────────────────────────────────────────────────

/**
 * Error types specific to nutrition lookup.
 *
 * Each variant represents a different kind of failure.
 * The calling code can check `type` to decide what to do:
 *
 *   if (error.type === "not_found") → show "food not found" message
 *   if (error.type === "api_error") → show "try again later" message
 *   if (error.type === "ambiguous_match") → show multiple options to user
 */
export type NutritionLookupError =
  | {
      type: "not_found";
      message: string;
      /** The query that produced no results */
      query: string;
    }
  | {
      type: "api_error";
      message: string;
      /** HTTP status code if available */
      statusCode?: number;
    }
  | {
      type: "timeout";
      message: string;
    }
  | {
      type: "validation_error";
      message: string;
      /** What specifically was invalid in the response */
      details?: string;
    }
  | {
      type: "ambiguous_match";
      message: string;
      /** The candidate matches the user should choose from */
      candidates: NutritionSearchResult[];
    };
