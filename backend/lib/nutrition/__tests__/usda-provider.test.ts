/**
 * Unit Tests — USDA Normalization Logic
 *
 * These tests verify that the USDANutritionProvider correctly converts
 * USDA's raw API responses into our internal NutritionData format.
 *
 * WHY WE TEST NORMALIZATION:
 * Normalization is where correctness matters most. If we map the wrong
 * USDA nutrient ID to "protein" or accidentally use 0 instead of null
 * for a missing vitamin, the mobile app will silently show wrong data.
 * These tests catch those bugs.
 *
 * HOW THESE TESTS WORK:
 * We don't call the real USDA API. Instead, we give the provider
 * FAKE HTTP responses that look exactly like what USDA returns, and
 * verify that it produces the right internal format.
 *
 * This technique is called MOCKING — we replace the real `fetch`
 * function with a test version that returns predetermined data.
 * That way, tests are:
 *   - Fast (no network calls)
 *   - Reliable (no USDA downtime or rate limits)
 *   - Deterministic (same input → same output every time)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { USDANutritionProvider } from "@/lib/nutrition/usda-provider";

// ─── Test Fixtures ───────────────────────────────────────────────
//
// "Fixtures" are sample data used across multiple tests.
// These mimic what the USDA API actually returns.

/** A realistic USDA search API response for "banana" */
const USDA_SEARCH_RESPONSE = {
  foods: [
    {
      fdcId: 173944,
      description: "Bananas, raw",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientId: 1008, nutrientName: "Energy", unitName: "kcal", value: 89 },
        { nutrientId: 1003, nutrientName: "Protein", unitName: "g", value: 1.09 },
      ],
      score: 246,
    },
    {
      fdcId: 174655,
      description: "Bananas, dehydrated, or banana powder",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientId: 1008, nutrientName: "Energy", unitName: "kcal", value: 346 },
      ],
      score: 123,
    },
  ],
  totalHits: 25,
  currentPage: 1,
  totalPages: 3,
};

/** A realistic USDA food detail response for "Bananas, raw" */
const USDA_DETAIL_RESPONSE = {
  fdcId: 173944,
  description: "Bananas, raw",
  dataType: "SR Legacy",
  foodNutrients: [
    { nutrient: { id: 1008, name: "Energy", unitName: "kcal" }, amount: 89 },
    { nutrient: { id: 1003, name: "Protein", unitName: "g" }, amount: 1.09 },
    { nutrient: { id: 1004, name: "Total lipid (fat)", unitName: "g" }, amount: 0.33 },
    { nutrient: { id: 1258, name: "Fatty acids, total saturated", unitName: "g" }, amount: 0.112 },
    { nutrient: { id: 1005, name: "Carbohydrate, by difference", unitName: "g" }, amount: 22.84 },
    { nutrient: { id: 1079, name: "Fiber, total dietary", unitName: "g" }, amount: 2.6 },
    { nutrient: { id: 2000, name: "Sugars, total including NLEA", unitName: "g" }, amount: 12.23 },
    { nutrient: { id: 1093, name: "Sodium, Na", unitName: "mg" }, amount: 1 },
    { nutrient: { id: 1253, name: "Cholesterol", unitName: "mg" }, amount: 0 },
    { nutrient: { id: 1092, name: "Potassium, K", unitName: "mg" }, amount: 358 },
    { nutrient: { id: 1162, name: "Vitamin C", unitName: "mg" }, amount: 8.7 },
    { nutrient: { id: 1087, name: "Calcium, Ca", unitName: "mg" }, amount: 5 },
    { nutrient: { id: 1089, name: "Iron, Fe", unitName: "mg" }, amount: 0.26 },
    // Note: Vitamin A (1106) is intentionally MISSING to test null handling
  ],
  servingSize: 118,
  servingSizeUnit: "g",
};

/** A USDA detail response with MINIMAL data — only calories */
const USDA_MINIMAL_DETAIL_RESPONSE = {
  fdcId: 999999,
  description: "Mystery food, generic",
  foodNutrients: [
    { nutrient: { id: 1008, name: "Energy", unitName: "kcal" }, amount: 100 },
  ],
  // No servingSize, no servingSizeUnit → should default to 100g
};

// ─── Helper: Mock fetch ──────────────────────────────────────────

/**
 * Replace the global `fetch` with a mock that returns the given data.
 * Each call returns the next response in the list.
 */
function mockFetch(...responses: Array<{ status: number; body: unknown }>) {
  const queue = [...responses];

  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const next = queue.shift();
    if (!next) {
      throw new Error("mockFetch: no more responses queued");
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

// ─── Tests ───────────────────────────────────────────────────────

describe("USDANutritionProvider", () => {
  const TEST_API_KEY = "test-api-key-not-real";
  let provider: USDANutritionProvider;

  beforeEach(() => {
    provider = new USDANutritionProvider(TEST_API_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Constructor ─────────────────────────────────────────────

  describe("constructor", () => {
    it("throws if API key is empty", () => {
      expect(() => new USDANutritionProvider("")).toThrow("API key is required");
    });
  });

  // ── searchFoods ─────────────────────────────────────────────

  describe("searchFoods", () => {
    it("normalizes USDA search results into our internal format", async () => {
      mockFetch({ status: 200, body: USDA_SEARCH_RESPONSE });

      const results = await provider.searchFoods("banana");

      expect(results).toHaveLength(2);

      // First result
      expect(results[0]).toEqual({
        sourceId: "173944",
        source: "usda_fdc",
        foodName: "Bananas, raw",
        description: null,
        dataType: "SR Legacy",
        score: 0.82, // 820.5 / 1000, rounded to 2 decimal places
      });

      // Second result — lower score
      expect(results[1]).toEqual({
        sourceId: "174655",
        source: "usda_fdc",
        foodName: "Bananas, dehydrated, or banana powder",
        description: null,
        dataType: "SR Legacy",
        score: 0.41, // 410.2 / 1000, rounded
      });
    });

    it("caps normalized scores at 1.0 when USDA score exceeds 1000", async () => {
      mockFetch({
        status: 200,
        body: {
          foods: [
            {
              fdcId: 100,
              description: "High-score food",
              score: 1500,
            },
          ],
          totalHits: 1,
        },
      });

      const results = await provider.searchFoods("food");
      expect(results[0].score).toBe(1);
    });

    it("defaults score to 0 when USDA omits the score", async () => {
      mockFetch({
        status: 200,
        body: {
          foods: [
            {
              fdcId: 100,
              description: "No-score food",
              // score is missing
            },
          ],
          totalHits: 1,
        },
      });

      const results = await provider.searchFoods("food");
      expect(results[0].score).toBe(0);
    });

    it("throws a not_found error when USDA returns zero foods", async () => {
      mockFetch({
        status: 200,
        body: { foods: [], totalHits: 0 },
      });

      await expect(provider.searchFoods("xyznonexistent")).rejects.toMatchObject({
        type: "not_found",
        query: "xyznonexistent",
      });
    });

    it("throws a validation_error for empty queries", async () => {
      await expect(provider.searchFoods("   ")).rejects.toMatchObject({
        type: "validation_error",
      });
    });

    it("throws an api_error when USDA returns 429 (rate limit)", async () => {
      mockFetch({ status: 429, body: { error: "Rate limit exceeded" } });

      await expect(provider.searchFoods("banana")).rejects.toMatchObject({
        type: "api_error",
        statusCode: 429,
      });
    });

    it("throws a not_found error when USDA returns 404", async () => {
      mockFetch({ status: 404, body: {} });

      await expect(provider.searchFoods("banana")).rejects.toMatchObject({
        type: "not_found",
      });
    });

    it("throws a validation_error when USDA returns malformed JSON shape", async () => {
      // Valid JSON, but wrong shape — no "foods" array
      mockFetch({
        status: 200,
        body: { results: [], count: 0 },
      });

      await expect(provider.searchFoods("banana")).rejects.toMatchObject({
        type: "validation_error",
      });
    });

    it("passes the API key as a query parameter (never in header)", async () => {
      const spy = mockFetch({ status: 200, body: USDA_SEARCH_RESPONSE });

      await provider.searchFoods("banana");

      const calledUrl = spy.mock.calls[0][0] as string;
      expect(calledUrl).toContain(`api_key=${TEST_API_KEY}`);
    });
  });

  // ── getFoodDetails ──────────────────────────────────────────

  describe("getFoodDetails", () => {
    it("normalizes a complete USDA detail response into NutritionData", async () => {
      mockFetch({ status: 200, body: USDA_DETAIL_RESPONSE });

      const data = await provider.getFoodDetails("173944");

      // Identity fields
      expect(data.foodName).toBe("Bananas, raw");
      expect(data.source).toBe("usda_fdc");
      expect(data.sourceId).toBe("173944");
      expect(data.sourceUrl).toBe(
        "https://fdc.nal.usda.gov/fdc-app.html#/food-details/173944/nutrients"
      );

      // Serving size from USDA
      expect(data.servingSize).toBe(118);
      expect(data.servingUnit).toBe("g");

      // Calories
      expect(data.calories).toBe(89);

      // Macronutrients — all present in the fixture
      expect(data.macronutrients.protein).toBe(1.09);
      expect(data.macronutrients.totalFat).toBe(0.33);
      expect(data.macronutrients.saturatedFat).toBe(0.112);
      expect(data.macronutrients.carbohydrates).toBe(22.84);
      expect(data.macronutrients.fiber).toBe(2.6);
      expect(data.macronutrients.sugar).toBe(12.23);

      // Micronutrients — most present, but vitaminA is MISSING
      expect(data.micronutrients.sodium).toBe(1);
      expect(data.micronutrients.cholesterol).toBe(0); // 0 means "contains none"
      expect(data.micronutrients.potassium).toBe(358);
      expect(data.micronutrients.vitaminC).toBe(8.7);
      expect(data.micronutrients.calcium).toBe(5);
      expect(data.micronutrients.iron).toBe(0.26);

      // vitaminA was missing from the fixture → should be null, NOT 0
      expect(data.micronutrients.vitaminA).toBeNull();
    });

    it("uses null (not 0) for all missing nutrients", async () => {
      // This response only has calories — everything else should be null
      mockFetch({ status: 200, body: USDA_MINIMAL_DETAIL_RESPONSE });

      const data = await provider.getFoodDetails("999999");

      // Calories is present
      expect(data.calories).toBe(100);

      // ALL macros should be null — they were not in the response
      expect(data.macronutrients.protein).toBeNull();
      expect(data.macronutrients.totalFat).toBeNull();
      expect(data.macronutrients.saturatedFat).toBeNull();
      expect(data.macronutrients.carbohydrates).toBeNull();
      expect(data.macronutrients.fiber).toBeNull();
      expect(data.macronutrients.sugar).toBeNull();

      // ALL micros should be null
      expect(data.micronutrients.sodium).toBeNull();
      expect(data.micronutrients.cholesterol).toBeNull();
      expect(data.micronutrients.potassium).toBeNull();
      expect(data.micronutrients.vitaminA).toBeNull();
      expect(data.micronutrients.vitaminC).toBeNull();
      expect(data.micronutrients.calcium).toBeNull();
      expect(data.micronutrients.iron).toBeNull();
    });

    it("defaults to 100g serving when USDA omits serving size", async () => {
      mockFetch({ status: 200, body: USDA_MINIMAL_DETAIL_RESPONSE });

      const data = await provider.getFoodDetails("999999");

      expect(data.servingSize).toBe(100);
      expect(data.servingUnit).toBe("g");
    });

    it("sets matchConfidence to 'exact' for direct ID lookups", async () => {
      mockFetch({ status: 200, body: USDA_DETAIL_RESPONSE });

      const data = await provider.getFoodDetails("173944");
      expect(data.matchConfidence).toBe("exact");
    });

    it("throws a validation_error for empty sourceId", async () => {
      await expect(provider.getFoodDetails("")).rejects.toMatchObject({
        type: "validation_error",
      });

      await expect(provider.getFoodDetails("   ")).rejects.toMatchObject({
        type: "validation_error",
      });
    });

    it("builds the correct USDA source URL", async () => {
      mockFetch({ status: 200, body: USDA_DETAIL_RESPONSE });

      const data = await provider.getFoodDetails("173944");
      expect(data.sourceUrl).toBe(
        "https://fdc.nal.usda.gov/fdc-app.html#/food-details/173944/nutrients"
      );
    });

    it("distinguishes zero from null in nutrient values", async () => {
      // Cholesterol = 0 in the fixture (the food has NO cholesterol)
      // VitaminA is missing from the fixture (we DON'T KNOW the value)
      mockFetch({ status: 200, body: USDA_DETAIL_RESPONSE });

      const data = await provider.getFoodDetails("173944");

      // These are different and must not be confused
      expect(data.micronutrients.cholesterol).toBe(0);      // known: none
      expect(data.micronutrients.vitaminA).toBeNull();       // unknown
    });
  });
});
