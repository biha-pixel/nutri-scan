import { z } from "zod";

/**
 * Zod Schemas for Nutrition Data
 *
 * These schemas validate data at RUNTIME — they catch problems that
 * TypeScript's compile-time checking cannot:
 *
 *   1. USDA API responses: We send a request and get JSON back.
 *      TypeScript trusts that JSON is whatever type we say it is.
 *      Zod actually checks the shape, so a malformed USDA response
 *      is caught immediately instead of causing a crash later.
 *
 *   2. Our own normalized output: Before sending nutrition data to
 *      the mobile app, we validate it. If our normalization code
 *      has a bug, Zod catches it at the server boundary — the app
 *      never receives broken data.
 */

// ─── USDA API Response Schemas ────────────────────────────────────
//
// These schemas describe what the USDA FoodData Central API actually
// returns. We validate the raw response against these schemas BEFORE
// we try to normalize the data. If USDA changes their response format,
// these schemas will reject the response and we'll get a clear error
// instead of silently producing wrong nutrition values.

/**
 * A single nutrient in a USDA food item.
 *
 * USDA returns nutrients as an array of objects, each with an ID and value.
 * For example, nutrient ID 1003 = Protein, value = 31.02 (grams per 100g).
 */
export const USDANutrientSchema = z.object({
  nutrientId: z.number(),
  nutrientName: z.string(),
  unitName: z.string(),
  value: z.number().optional(),
});

/**
 * A single food item in a USDA search response.
 *
 * The USDA search returns an array of these. Each represents one food
 * that matched the search query.
 */
export const USDASearchFoodSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  dataType: z.string().optional(),
  foodNutrients: z.array(USDANutrientSchema).optional().default([]),
  /** USDA provides a relevance score when searching */
  score: z.number().optional(),
});

/**
 * The top-level USDA search API response.
 *
 * Endpoint: GET /fdc/v1/foods/search?query=...&api_key=...
 */
export const USDASearchResponseSchema = z.object({
  foods: z.array(USDASearchFoodSchema),
  totalHits: z.number(),
  currentPage: z.number().optional(),
  totalPages: z.number().optional(),
});

/**
 * A single nutrient in a USDA food detail response.
 *
 * The detail endpoint returns a richer nutrient object than the search.
 */
export const USDADetailNutrientSchema = z.object({
  nutrient: z.object({
    id: z.number(),
    name: z.string(),
    unitName: z.string(),
  }),
  amount: z.number().optional(),
});

/**
 * The USDA food detail response for a single food item.
 *
 * Endpoint: GET /fdc/v1/food/{fdcId}?api_key=...
 */
export const USDAFoodDetailSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  dataType: z.string().optional(),
  foodNutrients: z.array(USDADetailNutrientSchema).optional().default([]),
  servingSize: z.number().optional(),
  servingSizeUnit: z.string().optional(),
});

// ─── Internal Nutrition Data Schemas ──────────────────────────────
//
// These schemas validate our OWN normalized data before we send it
// to the mobile app. Defence in depth: even if our normalization
// code is correct, we verify at the boundary.

/** Schema for nullable number fields (null = "data not available") */
const nullableNumber = z.number().nullable();

export const MacronutrientsSchema = z.object({
  protein: nullableNumber,
  totalFat: nullableNumber,
  saturatedFat: nullableNumber,
  carbohydrates: nullableNumber,
  fiber: nullableNumber,
  sugar: nullableNumber,
});

export const MicronutrientsSchema = z.object({
  sodium: nullableNumber,
  cholesterol: nullableNumber,
  potassium: nullableNumber,
  vitaminA: nullableNumber,
  vitaminC: nullableNumber,
  calcium: nullableNumber,
  iron: nullableNumber,
});

export const NutritionDataSchema = z.object({
  foodName: z.string().min(1),
  source: z.string().min(1),
  sourceId: z.string().min(1),
  servingSize: z.number().positive(),
  servingUnit: z.string().min(1),
  calories: nullableNumber,
  macronutrients: MacronutrientsSchema,
  micronutrients: MicronutrientsSchema,
  sourceUrl: z.string().url().nullable(),
  matchConfidence: z.enum(["exact", "close", "approximate"]),
});

export const NutritionSearchResultSchema = z.object({
  sourceId: z.string().min(1),
  source: z.string().min(1),
  foodName: z.string().min(1),
  description: z.string().nullable(),
  dataType: z.string().nullable(),
  score: z.number().min(0).max(1),
});

// ─── Type Inference from Schemas ──────────────────────────────────
//
// These types are inferred from the Zod schemas. They're useful when
// working with validated USDA data inside the normalization code.

export type USDANutrient = z.infer<typeof USDANutrientSchema>;
export type USDASearchFood = z.infer<typeof USDASearchFoodSchema>;
export type USDASearchResponse = z.infer<typeof USDASearchResponseSchema>;
export type USDADetailNutrient = z.infer<typeof USDADetailNutrientSchema>;
export type USDAFoodDetail = z.infer<typeof USDAFoodDetailSchema>;
