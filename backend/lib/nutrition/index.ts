/**
 * Nutrition Module — Public API
 *
 * This is a BARREL FILE. It re-exports only what other modules need.
 *
 * Any code outside lib/nutrition/ imports from here:
 *   import { NutritionLookupService, USDANutritionProvider } from "@/lib/nutrition";
 *
 * They never import from individual files like:
 *   import { USDANutritionProvider } from "@/lib/nutrition/usda-provider";  // ← Don't do this
 *
 * WHY?
 * 1. Encapsulation: We control what's public. Internal helpers stay internal.
 * 2. Refactoring: We can rename/move files inside the module without
 *    breaking imports in the rest of the codebase.
 * 3. Discoverability: One file shows everything the module offers.
 */

// Types — the shapes of data this module works with
export type {
  NutritionData,
  Macronutrients,
  Micronutrients,
  NutritionSearchResult,
  NutritionLookupError,
} from "./types";

// Interface — the contract any nutrition provider must implement
export type { NutritionProvider } from "./nutrition-provider";

// Service — the orchestrator that the rest of the backend calls
export {
  NutritionLookupService,
  type NutritionLookupResult,
} from "./nutrition-service";

// Concrete provider — USDA FoodData Central
export { USDANutritionProvider } from "./usda-provider";

// Schemas — Zod validation schemas (useful for testing and route handlers)
export {
  NutritionDataSchema,
  NutritionSearchResultSchema,
  MacronutrientsSchema,
  MicronutrientsSchema,
} from "./schemas";
