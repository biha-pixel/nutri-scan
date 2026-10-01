/**
 * USDA FoodData Central Provider
 *
 * This is the CONCRETE IMPLEMENTATION of the NutritionProvider interface
 * for the USDA FoodData Central API (https://fdc.nal.usda.gov/).
 *
 * WHAT THIS FILE DOES:
 * 1. Sends HTTP requests to the USDA API
 * 2. Validates the raw JSON response with Zod
 * 3. NORMALIZES the USDA-specific data into our internal NutritionData format
 *
 * The rest of the backend never sees USDA's raw response format. It only
 * sees our normalized NutritionData type, which is the same regardless of
 * whether the data came from USDA, Open Food Facts, or any future source.
 *
 * USDA NUTRIENT IDS:
 * The USDA API identifies nutrients by numeric IDs rather than names.
 * For example, protein is nutrient ID 1003. We maintain a mapping
 * from those IDs to our internal field names.
 */

import type { NutritionProvider } from "./nutrition-provider";
import type { NutritionData, NutritionSearchResult } from "./types";
import type { NutritionLookupError } from "./types";
import {
  USDASearchResponseSchema,
  USDAFoodDetailSchema,
  NutritionDataSchema,
  type USDASearchFood,
  type USDAFoodDetail,
  type USDADetailNutrient,
} from "./schemas";

// ─── USDA Nutrient ID Map ─────────────────────────────────────────
//
// Each nutrient in the USDA database has a numeric ID.
// This map connects those IDs to the field names in our
// Macronutrients and Micronutrients interfaces.

const USDA_NUTRIENT_IDS = {
  calories: 1008,      // Energy (kcal)
  protein: 1003,       // Protein (g)
  totalFat: 1004,      // Total lipid / fat (g)
  saturatedFat: 1258,  // Fatty acids, total saturated (g)
  carbohydrates: 1005, // Carbohydrate, by difference (g)
  fiber: 1079,         // Fiber, total dietary (g)
  sugar: 2000,         // Sugars, total including NLEA (g)
  sodium: 1093,        // Sodium, Na (mg)
  cholesterol: 1253,   // Cholesterol (mg)
  potassium: 1092,     // Potassium, K (mg)
  vitaminA: 1106,      // Vitamin A, RAE (µg)
  vitaminC: 1162,      // Vitamin C, total ascorbic acid (mg)
  calcium: 1087,       // Calcium, Ca (mg)
  iron: 1089,          // Iron, Fe (mg)
} as const;

/** Base URL for the USDA FoodData Central API */
const USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1";

/**
 * How long to wait for a USDA API response before timing out (in ms).
 * USDA can be slow — 10 seconds is generous but prevents hanging forever.
 */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Maximum number of search results to request from USDA.
 * We don't need 50 results for a food lookup — the top matches
 * are the most relevant.
 */
const MAX_SEARCH_RESULTS = 10;

/**
 * Preferred data types from USDA, in order of preference.
 *
 * USDA has several food databases:
 * - "Foundation": High-quality analytical data; most reliable
 * - "SR Legacy": Standard Reference; comprehensive and well-established
 * - "Survey (FNDDS)": Foods as consumed in dietary surveys
 * - "Branded": Brand-name packaged products
 *
 * We prefer Foundation and SR Legacy because they have the most
 * complete, well-reviewed nutrient profiles for whole/generic foods.
 */
const PREFERRED_DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];

export class USDANutritionProvider implements NutritionProvider {
  readonly providerName = "USDA FoodData Central";

  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error(
        "USDA API key is required. Get one free at https://fdc.nal.usda.gov/api-key-signup.html"
      );
    }
    this.apiKey = apiKey;
  }

  // ─── Public Interface Methods ─────────────────────────────────

  /**
   * Search USDA for foods matching a query.
   *
   * Uses the /foods/search POST endpoint with a JSON payload:
   * - query: the food name
   * - dataType: we prefer Foundation, SR Legacy, and Survey (FNDDS) for generic foods
   * - pageSize: limit results to avoid overwhelming the user
   *
   * Returns results sorted by USDA's relevance score, normalized to 0–1.
   */
  async searchFoods(query: string): Promise<NutritionSearchResult[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      const error: NutritionLookupError = {
        type: "validation_error",
        message: "Search query cannot be empty.",
        details: "Received an empty or whitespace-only query string.",
      };
      throw error;
    }

    const url = new URL(`${USDA_API_BASE}/foods/search`);
    url.searchParams.set("api_key", this.apiKey);

    const rawData = await this.fetchWithTimeout(url.toString(), {
      method: "POST",
      body: JSON.stringify({
        query: trimmedQuery,
        dataType: PREFERRED_DATA_TYPES,
        pageSize: MAX_SEARCH_RESULTS,
      }),
    });

    // Validate the raw response against our schema
    const parseResult = USDASearchResponseSchema.safeParse(rawData);
    if (!parseResult.success) {
      const error: NutritionLookupError = {
        type: "validation_error",
        message: "USDA API returned an unexpected response format.",
        details: parseResult.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      };
      throw error;
    }

    const validated = parseResult.data;

    if (validated.foods.length === 0) {
      const error: NutritionLookupError = {
        type: "not_found",
        message: `No foods found matching "${trimmedQuery}".`,
        query: trimmedQuery,
      };
      throw error;
    }

    // Normalize each USDA search result into our internal format
    return validated.foods.map((food) =>
      this.normalizeSearchResult(food, trimmedQuery)
    );
  }

  /**
   * Get full nutrition details for a specific food by its USDA FDC ID.
   *
   * Uses the /food/{fdcId} endpoint to get the complete nutrient profile,
   * then normalizes it into our NutritionData format.
   */
  async getFoodDetails(sourceId: string): Promise<NutritionData> {
    if (!sourceId || !sourceId.trim()) {
      const error: NutritionLookupError = {
        type: "validation_error",
        message: "Food source ID cannot be empty.",
        details: "Received an empty or whitespace-only source ID.",
      };
      throw error;
    }

    const url = new URL(`${USDA_API_BASE}/food/${sourceId}`);
    url.searchParams.set("api_key", this.apiKey);

    const rawData = await this.fetchWithTimeout(url.toString());

    // Validate the raw response
    const parseResult = USDAFoodDetailSchema.safeParse(rawData);
    if (!parseResult.success) {
      const error: NutritionLookupError = {
        type: "validation_error",
        message: "USDA API returned an unexpected detail response format.",
        details: parseResult.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      };
      throw error;
    }

    const validated = parseResult.data;

    // Normalize USDA's data into our internal format
    const nutritionData = this.normalizeDetailResponse(validated);

    // Final validation: make sure our normalization produced valid output
    const outputValidation = NutritionDataSchema.safeParse(nutritionData);
    if (!outputValidation.success) {
      const error: NutritionLookupError = {
        type: "validation_error",
        message: "Normalized nutrition data failed validation.",
        details: outputValidation.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      };
      throw error;
    }

    return outputValidation.data as NutritionData;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Make an HTTP request with a timeout.
   *
   * If the USDA API doesn't respond within REQUEST_TIMEOUT_MS,
   * we abort the request and throw a timeout error rather than
   * hanging indefinitely.
   */
  private async fetchWithTimeout(
    url: string,
    options?: RequestInit
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: options?.method ?? "GET",
        headers: {
          "Accept": "application/json",
          ...(options?.body ? { "Content-Type": "application/json" } : {}),
          ...options?.headers,
        },
        body: options?.body,
        signal: controller.signal,
      });

      if (!response.ok) {
        // Handle specific HTTP error codes
        if (response.status === 404) {
          const error: NutritionLookupError = {
            type: "not_found",
            message: "The requested food was not found in the USDA database.",
            query: url,
          };
          throw error;
        }

        if (response.status === 429) {
          const error: NutritionLookupError = {
            type: "api_error",
            message:
              "USDA API rate limit exceeded. Please wait a moment and try again.",
            statusCode: 429,
          };
          throw error;
        }

        const error: NutritionLookupError = {
          type: "api_error",
          message: `USDA API returned HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
        throw error;
      }

      // Parse JSON — if it fails, the USDA response is malformed
      try {
        return await response.json();
      } catch {
        const error: NutritionLookupError = {
          type: "validation_error",
          message: "USDA API returned invalid JSON.",
        };
        throw error;
      }
    } catch (err) {
      // Re-throw our own NutritionLookupError instances
      if (err && typeof err === "object" && "type" in err) {
        throw err;
      }

      // Handle abort (timeout)
      if (err instanceof DOMException && err.name === "AbortError") {
        const error: NutritionLookupError = {
          type: "timeout",
          message: `USDA API did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`,
        };
        throw error;
      }

      // Handle network errors (no internet, DNS failure, etc.)
      const error: NutritionLookupError = {
        type: "api_error",
        message: `Failed to connect to USDA API: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convert a USDA search result into our NutritionSearchResult format.
   *
   * This is DATA NORMALIZATION: taking USDA's specific field names
   * (fdcId, description, dataType, score) and mapping them to our
   * internal field names (sourceId, foodName, dataType, score).
   *
   * Normalizing relevance score:
   * USDA FoodData Central uses Lucene search scoring. In Lucene, each search
   * term contributes ~250-350 to the top matching document's score.
   * A 1-word query ("apple") peaks around ~300. A 2-word query ("cheddar cheese")
   * peaks around ~600.
   *
   * To normalize reliably across queries of different lengths, we scale by
   * the estimated maximum score based on query term count (minimum 300).
   */
  private normalizeSearchResult(
    food: USDASearchFood,
    query?: string
  ): NutritionSearchResult {
    const rawScore = food.score ?? 0;
    const queryTerms = query
      ? query.trim().split(/\s+/).filter(Boolean).length
      : 1;
    const estimatedMaxScore = Math.max(300, queryTerms * 300);
    const normalizedScore = Math.min(rawScore / estimatedMaxScore, 1);

    return {
      sourceId: String(food.fdcId),
      source: "usda_fdc",
      foodName: food.description,
      description: null, // USDA search doesn't provide a separate description
      dataType: food.dataType ?? null,
      score: Math.round(normalizedScore * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Convert a USDA food detail response into our NutritionData format.
   *
   * This is the core NORMALIZATION function. It:
   * 1. Maps USDA nutrient IDs to our field names
   * 2. Uses `null` for any nutrient not present (NOT zero)
   * 3. Sets a default serving size if USDA doesn't provide one
   * 4. Builds a URL back to the USDA website for reference
   */
  private normalizeDetailResponse(detail: USDAFoodDetail): NutritionData {
    // Build a lookup map: nutrient ID → amount
    // This makes it easy to extract specific nutrients by ID.
    const nutrientMap = new Map<number, number>();
    for (const fn of detail.foodNutrients) {
      if (fn.amount !== undefined) {
        nutrientMap.set(fn.nutrient.id, fn.amount);
      }
    }

    /**
     * Helper: get a nutrient value by its USDA ID.
     * Returns null if the nutrient isn't in the response.
     * Remember: null = "we don't know", not "zero".
     */
    const getNutrient = (id: number): number | null => {
      const value = nutrientMap.get(id);
      return value !== undefined ? value : null;
    };

    // USDA defaults to per-100g if no serving size is specified
    const servingSize = detail.servingSize ?? 100;
    const servingUnit = detail.servingSizeUnit ?? "g";

    return {
      foodName: detail.description,
      source: "usda_fdc",
      sourceId: String(detail.fdcId),
      servingSize,
      servingUnit,
      calories: getNutrient(USDA_NUTRIENT_IDS.calories),
      macronutrients: {
        protein: getNutrient(USDA_NUTRIENT_IDS.protein),
        totalFat: getNutrient(USDA_NUTRIENT_IDS.totalFat),
        saturatedFat: getNutrient(USDA_NUTRIENT_IDS.saturatedFat),
        carbohydrates: getNutrient(USDA_NUTRIENT_IDS.carbohydrates),
        fiber: getNutrient(USDA_NUTRIENT_IDS.fiber),
        sugar: getNutrient(USDA_NUTRIENT_IDS.sugar),
      },
      micronutrients: {
        sodium: getNutrient(USDA_NUTRIENT_IDS.sodium),
        cholesterol: getNutrient(USDA_NUTRIENT_IDS.cholesterol),
        potassium: getNutrient(USDA_NUTRIENT_IDS.potassium),
        vitaminA: getNutrient(USDA_NUTRIENT_IDS.vitaminA),
        vitaminC: getNutrient(USDA_NUTRIENT_IDS.vitaminC),
        calcium: getNutrient(USDA_NUTRIENT_IDS.calcium),
        iron: getNutrient(USDA_NUTRIENT_IDS.iron),
      },
      sourceUrl: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${detail.fdcId}/nutrients`,
      matchConfidence: "exact", // We're fetching by exact ID, so it's an exact match
    };
  }
}
