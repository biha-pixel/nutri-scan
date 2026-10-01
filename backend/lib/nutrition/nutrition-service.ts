/**
 * Nutrition Lookup Service
 *
 * This is the SERVICE LAYER — the single entry point the rest of the
 * backend uses for nutrition lookups. It sits between the API route
 * handler and the nutrition provider.
 *
 * WHY A SERVICE LAYER?
 * The API route handler's job is HTTP: parse the request, return a response.
 * The provider's job is data: talk to USDA and normalize the result.
 * The service's job is BUSINESS LOGIC — the decisions in between:
 *
 *   - Should we auto-select the best match, or return candidates?
 *   - How do we define "best match" vs "ambiguous"?
 *   - Should we log the lookup? Cache the result? (future)
 *
 * This is the SAME PATTERN as FoodAnalysisService in lib/food/.
 * That service orchestrates vision analysis; this one orchestrates
 * nutrition lookups.
 */

import type { NutritionProvider } from "./nutrition-provider";
import type {
  NutritionData,
  NutritionSearchResult,
  NutritionLookupError,
} from "./types";

/**
 * The result of a nutrition lookup — either successful data
 * or an error explaining what went wrong.
 *
 * This is a DISCRIMINATED UNION: the `success` field tells
 * TypeScript which branch you're in, so you get type safety:
 *
 *   const result = await service.lookupNutrition("banana");
 *   if (result.success) {
 *     console.log(result.data.calories); // TypeScript knows `data` exists
 *   } else {
 *     console.log(result.error.type);    // TypeScript knows `error` exists
 *   }
 */
export type NutritionLookupResult =
  | { success: true; data: NutritionData }
  | { success: false; error: NutritionLookupError };

/**
 * Threshold for auto-selecting the best match.
 *
 * If the top search result's normalized score is >= this value,
 * we consider it a confident match and automatically fetch its details.
 *
 * If it's below this, the match is AMBIGUOUS — we return the candidates
 * to the user and let them choose, rather than silently picking one.
 *
 * Why 0.6? It's conservative. A score of 0.6+ from USDA typically means
 * the description closely matches the query. Below that, the results
 * are often loosely related foods — "chicken breast" vs "chicken broth".
 */
const AUTO_SELECT_THRESHOLD = 0.6;

/**
 * Maximum candidates to return when a match is ambiguous.
 * We don't want to overwhelm the user with 50 options.
 */
const MAX_AMBIGUOUS_CANDIDATES = 5;

export class NutritionLookupService {
  private readonly provider: NutritionProvider;

  /**
   * @param provider - Any NutritionProvider implementation (USDA, Open Food Facts, etc.)
   *
   * This is DEPENDENCY INJECTION: the service doesn't create its own provider.
   * The caller chooses which provider to use and passes it in. This means:
   * - In production: pass USDANutritionProvider
   * - In tests: pass a mock provider
   * - In the future: pass OpenFoodFactsProvider without changing this class
   */
  constructor(provider: NutritionProvider) {
    this.provider = provider;
  }

  /**
   * Look up nutrition data for a food item.
   *
   * This is the main method the API route calls. The flow:
   *
   *   1. Search for the food by name → get a list of candidates
   *   2. If the top result is a confident match → auto-select it
   *   3. If no confident match → return candidates for the user to choose
   *   4. Fetch full nutrition details for the selected food
   *   5. Return the normalized NutritionData
   *
   * Every error is caught and returned as a NutritionLookupResult
   * with `success: false` — this method never throws.
   */
  async lookupNutrition(foodName: string): Promise<NutritionLookupResult> {
    if (!foodName || !foodName.trim()) {
      return {
        success: false,
        error: {
          type: "validation_error",
          message: "Food name cannot be empty.",
        },
      };
    }

    try {
      // Step 1: Search for the food
      const searchResults = await this.provider.searchFoods(foodName);

      // Step 2: Evaluate the best match
      const bestMatch = searchResults[0];
      if (!bestMatch) {
        // searchFoods should throw not_found, but guard against empty arrays
        return {
          success: false,
          error: {
            type: "not_found",
            message: `No foods found matching "${foodName}".`,
            query: foodName,
          },
        };
      }

      // Step 3: Is the match confident enough to auto-select?
      if (bestMatch.score < AUTO_SELECT_THRESHOLD) {
        // AMBIGUOUS: the best match isn't confident enough.
        // Return candidates and let the user decide.
        // We NEVER silently pick a random food.
        return {
          success: false,
          error: {
            type: "ambiguous_match",
            message:
              `Multiple possible matches for "${foodName}". ` +
              `Please select the correct one.`,
            candidates: searchResults.slice(0, MAX_AMBIGUOUS_CANDIDATES),
          },
        };
      }

      // Step 4: Confident match — fetch full details
      const nutritionData = await this.provider.getFoodDetails(
        bestMatch.sourceId
      );

      // Update matchConfidence based on how close the match was
      nutritionData.matchConfidence = this.assessConfidence(
        bestMatch.score,
        foodName,
        nutritionData.foodName
      );

      return { success: true, data: nutritionData };
    } catch (err) {
      // Convert known error types
      if (this.isNutritionLookupError(err)) {
        return { success: false, error: err };
      }

      // Unexpected errors — wrap them
      return {
        success: false,
        error: {
          type: "api_error",
          message: `Unexpected error during nutrition lookup: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        },
      };
    }
  }

  /**
   * Get nutrition details for a specific food by its source ID.
   *
   * This is used when the user has already chosen from a list of
   * ambiguous candidates. We skip the search step and go directly
   * to fetching the full nutrition data.
   */
  async getNutritionById(sourceId: string): Promise<NutritionLookupResult> {
    if (!sourceId || !sourceId.trim()) {
      return {
        success: false,
        error: {
          type: "validation_error",
          message: "Source ID cannot be empty.",
        },
      };
    }

    try {
      const nutritionData = await this.provider.getFoodDetails(sourceId);
      return { success: true, data: nutritionData };
    } catch (err) {
      if (this.isNutritionLookupError(err)) {
        return { success: false, error: err };
      }

      return {
        success: false,
        error: {
          type: "api_error",
          message: `Unexpected error fetching nutrition data: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        },
      };
    }
  }

  /**
   * Search for foods without auto-selecting.
   *
   * Returns the raw search results — useful when the caller wants
   * to present options to the user without any auto-selection logic.
   */
  async searchFoods(
    query: string
  ): Promise<
    | { success: true; results: NutritionSearchResult[] }
    | { success: false; error: NutritionLookupError }
  > {
    if (!query || !query.trim()) {
      return {
        success: false,
        error: {
          type: "validation_error",
          message: "Search query cannot be empty.",
        },
      };
    }

    try {
      const results = await this.provider.searchFoods(query);
      return { success: true, results };
    } catch (err) {
      if (this.isNutritionLookupError(err)) {
        return { success: false, error: err };
      }

      return {
        success: false,
        error: {
          type: "api_error",
          message: `Unexpected error searching for foods: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        },
      };
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Assess how confident we are in the match.
   *
   * - "exact": The USDA food name closely matches our query
   * - "close": Good match, but names differ somewhat
   * - "approximate": Weaker match; user should verify
   */
  private assessConfidence(
    score: number,
    queryName: string,
    resultName: string
  ): "exact" | "close" | "approximate" {
    // Normalize both names for comparison
    const normalizedQuery = queryName.toLowerCase().trim();
    const normalizedResult = resultName.toLowerCase().trim();

    // If the USDA name contains our query (or vice versa), it's a close or exact match
    if (
      normalizedResult.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedResult)
    ) {
      return score >= 0.8 ? "exact" : "close";
    }

    // Otherwise, rely on the score
    if (score >= 0.8) return "close";
    return "approximate";
  }

  /**
   * Type guard: checks if an unknown error is a NutritionLookupError.
   */
  private isNutritionLookupError(err: unknown): err is NutritionLookupError {
    return (
      err !== null &&
      typeof err === "object" &&
      "type" in err &&
      "message" in err &&
      typeof (err as NutritionLookupError).type === "string" &&
      typeof (err as NutritionLookupError).message === "string"
    );
  }
}
