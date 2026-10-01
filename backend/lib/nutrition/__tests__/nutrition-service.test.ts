/**
 * Unit Tests — NutritionLookupService
 *
 * These tests verify the orchestrator / service layer:
 *   1. Auto-selects high-confidence results (score >= 0.6)
 *   2. Flags ambiguous matches when score is low (< 0.6)
 *   3. Limits candidates to MAX_AMBIGUOUS_CANDIDATES (5)
 *   4. Direct ID lookups via getNutritionById
 *   5. Error encapsulation into discriminated union { success: false, error }
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NutritionLookupService } from "@/lib/nutrition/nutrition-service";
import type { NutritionProvider } from "@/lib/nutrition/nutrition-provider";
import type { NutritionData, NutritionSearchResult } from "@/lib/nutrition/types";

// ─── Test Helpers & Mocks ────────────────────────────────────────

function createMockBananaData(): NutritionData {
  return {
    foodName: "Bananas, raw",
    source: "usda_fdc",
    sourceId: "173944",
    servingSize: 118,
    servingUnit: "g",
    calories: 89,
    macronutrients: {
      protein: 1.09,
      totalFat: 0.33,
      saturatedFat: 0.112,
      carbohydrates: 22.84,
      fiber: 2.6,
      sugar: 12.23,
    },
    micronutrients: {
      sodium: 1,
      cholesterol: 0,
      potassium: 358,
      vitaminA: null,
      vitaminC: 8.7,
      calcium: 5,
      iron: 0.26,
    },
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/173944/nutrients",
    matchConfidence: "exact",
  };
}

describe("NutritionLookupService", () => {
  let mockProvider: NutritionProvider;
  let service: NutritionLookupService;

  beforeEach(() => {
    mockProvider = {
      providerName: "mock_provider",
      searchFoods: vi.fn(),
      getFoodDetails: vi.fn(),
    };
    service = new NutritionLookupService(mockProvider);
  });

  describe("lookupNutrition", () => {
    it("auto-selects and fetches details when top search result has high confidence (score >= 0.6)", async () => {
      const searchResults: NutritionSearchResult[] = [
        {
          sourceId: "173944",
          source: "mock_provider",
          foodName: "Bananas, raw",
          description: null,
          dataType: "SR Legacy",
          score: 0.85,
        },
      ];

      vi.mocked(mockProvider.searchFoods).mockResolvedValue(searchResults);
      vi.mocked(mockProvider.getFoodDetails).mockResolvedValue(createMockBananaData());

      const result = await service.lookupNutrition("banana");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.foodName).toBe("Bananas, raw");
        expect(result.data.matchConfidence).toBe("exact"); // score >= 0.8 => exact
      }
      expect(mockProvider.searchFoods).toHaveBeenCalledWith("banana");
      expect(mockProvider.getFoodDetails).toHaveBeenCalledWith("173944");
    });

    it("assigns 'close' confidence when top score is between 0.6 and 0.8", async () => {
      const searchResults: NutritionSearchResult[] = [
        {
          sourceId: "173944",
          source: "mock_provider",
          foodName: "Banana slices",
          description: null,
          dataType: "Survey (FNDDS)",
          score: 0.72,
        },
      ];

      vi.mocked(mockProvider.searchFoods).mockResolvedValue(searchResults);
      vi.mocked(mockProvider.getFoodDetails).mockResolvedValue(createMockBananaData());

      const result = await service.lookupNutrition("banana");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.matchConfidence).toBe("close");
      }
    });

    it("returns ambiguous_match with top 5 candidates when score is below 0.6 threshold", async () => {
      const searchResults: NutritionSearchResult[] = [
        { sourceId: "1", source: "mock", foodName: "Food 1", description: null, dataType: null, score: 0.45 },
        { sourceId: "2", source: "mock", foodName: "Food 2", description: null, dataType: null, score: 0.42 },
        { sourceId: "3", source: "mock", foodName: "Food 3", description: null, dataType: null, score: 0.38 },
        { sourceId: "4", source: "mock", foodName: "Food 4", description: null, dataType: null, score: 0.30 },
        { sourceId: "5", source: "mock", foodName: "Food 5", description: null, dataType: null, score: 0.25 },
        { sourceId: "6", source: "mock", foodName: "Food 6", description: null, dataType: null, score: 0.20 },
      ];

      vi.mocked(mockProvider.searchFoods).mockResolvedValue(searchResults);

      const result = await service.lookupNutrition("unknown dish");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ambiguous_match");
        if (result.error.type === "ambiguous_match") {
          expect(result.error.candidates).toHaveLength(5); // sliced to max 5
          expect(result.error.candidates[0].sourceId).toBe("1");
        }
      }
      expect(mockProvider.getFoodDetails).not.toHaveBeenCalled();
    });

    it("returns validation_error for empty or whitespace-only input", async () => {
      const result = await service.lookupNutrition("   ");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
      }
    });

    it("gracefully catches thrown errors from the provider and wraps them in a failure result", async () => {
      vi.mocked(mockProvider.searchFoods).mockRejectedValue({
        type: "api_error",
        message: "USDA API is down",
        statusCode: 500,
      });

      const result = await service.lookupNutrition("banana");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("api_error");
        expect(result.error.message).toBe("USDA API is down");
      }
    });
  });

  describe("getNutritionById", () => {
    it("retrieves details directly by source ID with 'exact' confidence", async () => {
      vi.mocked(mockProvider.getFoodDetails).mockResolvedValue(createMockBananaData());

      const result = await service.getNutritionById("173944");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sourceId).toBe("173944");
        expect(result.data.matchConfidence).toBe("exact");
      }
      expect(mockProvider.getFoodDetails).toHaveBeenCalledWith("173944");
    });

    it("returns validation_error when source ID is empty", async () => {
      const result = await service.getNutritionById("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
      }
    });
  });

  describe("searchFoods", () => {
    it("returns search results without auto-selecting", async () => {
      const searchResults: NutritionSearchResult[] = [
        { sourceId: "173944", source: "mock", foodName: "Bananas, raw", description: null, dataType: "SR Legacy", score: 0.85 },
      ];

      vi.mocked(mockProvider.searchFoods).mockResolvedValue(searchResults);

      const result = await service.searchFoods("banana");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.results).toHaveLength(1);
        expect(result.results[0].foodName).toBe("Bananas, raw");
      }
    });
  });
});
