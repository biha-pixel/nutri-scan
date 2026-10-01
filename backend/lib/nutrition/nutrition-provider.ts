/**
 * Nutrition Provider Interface
 *
 * This is the ABSTRACTION LAYER for nutrition data sources.
 *
 * WHY AN INTERFACE?
 * Right now we only have USDA. But later we want Open Food Facts (for
 * packaged products with barcodes) and maybe a custom database (for
 * local/regional foods). If every part of the backend called USDA
 * directly, adding another source would mean changing code everywhere.
 *
 * With this interface, the rest of the backend says:
 *   "Give me nutrition for this food"
 * and doesn't care whether the answer comes from USDA, Open Food Facts,
 * or a JSON file on disk. We swap providers by changing ONE line — the
 * line that creates the provider instance.
 *
 * This is the SAME PATTERN used for VisionProvider in lib/food/.
 */

import type { NutritionData, NutritionSearchResult } from "./types";

/**
 * Any nutrition data source must implement this interface.
 *
 * The two methods represent the two-step lookup pattern:
 *
 *   Step 1: searchFoods("chicken breast")
 *           → Returns a list of candidates (names, IDs, scores)
 *
 *   Step 2: getFoodDetails("171077")
 *           → Returns full nutrition data for one specific food
 *
 * Why two steps instead of one?
 * - A search query like "chicken" might match 50+ foods.
 * - We don't want to fetch full nutrition for all 50.
 * - Step 1 gives us enough to pick the best match.
 * - Step 2 gets the full data for just that one.
 */
export interface NutritionProvider {
  /**
   * Search for foods matching a query string.
   *
   * @param query - The food name to search (e.g., "Bananas, raw")
   * @returns Array of matching foods, sorted by relevance (best first)
   * @throws On network errors or API failures
   */
  searchFoods(query: string): Promise<NutritionSearchResult[]>;

  /**
   * Get full nutrition details for a specific food by its source ID.
   *
   * @param sourceId - The food's identifier in the data source (e.g., USDA FDC ID "171077")
   * @returns Complete nutrition data in our normalized format
   * @throws On network errors, API failures, or if the food ID doesn't exist
   */
  getFoodDetails(sourceId: string): Promise<NutritionData>;

  /**
   * Human-readable name of this provider (for logging and error messages).
   * Example: "USDA FoodData Central", "Open Food Facts"
   */
  readonly providerName: string;
}
