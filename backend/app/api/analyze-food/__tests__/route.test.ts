/**
 * Integration Tests — /api/analyze-food Route Handler
 *
 * Tests the full HTTP API flow using mocked AI and Nutrition providers:
 * 1. Single food detection and nutrition lookup (Happy path)
 * 2. Multi-food detection with parallel USDA resolution
 * 3. Non-food image detection (graceful empty result)
 * 4. Ambiguous food matching (returns USDA candidates)
 * 5. Partial nutrition lookup failure (individual item degradation)
 * 6. AI Vision Provider failure (clean HTTP 400/500 error)
 * 7. Malformed request handling (missing file, invalid MIME, oversized)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import { FoodAnalysisService } from "@/lib/food/analysis-service";
import { NutritionLookupService } from "@/lib/nutrition/nutrition-service";
import {
  singleFoodFixture,
  multipleFoodsFixture,
  noFoodFixture,
  ambiguousFoodFixture,
  nutritionApiFailureFixture,
  aiFailureFixture,
  calibratedMarkerDetectedFixture,
  uncalibratedMarkerNotDetectedFixture,
  markerLowConfidenceFixture,
  markerTooSmallFixture,
} from "../../../../test/fixtures/food-fixtures";

describe("Integration: POST /api/analyze-food", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to construct a standard multipart NextRequest
  function createMockRequest(
    fileBuffer: Buffer = Buffer.from("valid-fake-image-bytes"),
    fileName = "photo.jpg",
    mimeType = "image/jpeg"
  ): NextRequest {
    const file = new File([new Uint8Array(fileBuffer)], fileName, { type: mimeType });
    const formData = new FormData();
    formData.append("image", file);

    return new NextRequest("http://localhost:3000/api/analyze-food", {
      method: "POST",
      body: formData,
    });
  }

  describe("Scenario 1: Single Food Recognition (Banana)", () => {
    it("returns 200 with recognized food, USDA nutrition data, and deterministic highlights", async () => {
      vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockResolvedValue(
        singleFoodFixture.visionResult
      );

      vi.spyOn(NutritionLookupService.prototype, "lookupNutrition").mockResolvedValue({
        success: true,
        data: singleFoodFixture.nutritionData,
      });

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(1);

      const item = json.data.items[0];
      expect(item.name).toBe("banana");
      expect(item.confidence).toBe(0.95);
      expect(item.nutritionStatus).toBe("found");
      // Nutrition is now scaled from 118g base to 150g (fallback estimate)
      // Scale factor: 150/118 ≈ 1.271
      // Calories: 105 × 1.271 ≈ 133
      expect(item.nutrition.calories).toBe(133);
      // Check that carbs are present and reasonable (scaled value)
      expect(item.nutrition.macronutrients.carbohydrates).toBeGreaterThan(25);
      expect(item.nutrition.macronutrients.carbohydrates).toBeLessThan(40);
      expect(item.highlights.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Scenario 2: Multiple Food Recognition (Meal Plate)", () => {
    it("processes all food items in parallel and resolves nutrition for each", async () => {
      vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockResolvedValue(
        multipleFoodsFixture.visionResult
      );

      vi.spyOn(NutritionLookupService.prototype, "lookupNutrition").mockImplementation(
        async (query: string) => {
          if (query.includes("chicken")) {
            return { success: true, data: multipleFoodsFixture.nutritionItems[0] };
          }
          if (query.includes("broccoli")) {
            return { success: true, data: multipleFoodsFixture.nutritionItems[1] };
          }
          return {
            success: false,
            error: {
              type: "not_found",
              query,
              message: `No nutrition data for ${query}`,
            },
          };
        }
      );

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(3);

      // Check chicken item
      const chicken = json.data.items.find((i: any) => i.name === "Grilled Chicken Breast");
      expect(chicken).toBeDefined();
      expect(chicken.nutritionStatus).toBe("found");
      expect(chicken.nutrition.macronutrients.protein).toBe(46.5);

      // Check rice item (not_found in mock)
      const rice = json.data.items.find((i: any) => i.name === "Brown Rice");
      expect(rice).toBeDefined();
      expect(rice.nutritionStatus).toBe("not_found");
      expect(rice.nutrition).toBeNull();
    });
  });

  describe("Scenario 3: Non-Food Image", () => {
    it("returns empty items array with descriptive user message when no food detected", async () => {
      vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockResolvedValue(
        noFoodFixture.visionResult
      );

      const lookupSpy = vi.spyOn(NutritionLookupService.prototype, "lookupNutrition");

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(0);
      expect(json.data.imageQuality).toBe("unrecognizable");
      expect(json.data.message).toContain("No food items");

      // Nutrition lookup should not be triggered if no foods identified
      expect(lookupSpy).not.toHaveBeenCalled();
    });
  });

  describe("Scenario 4 & 5: Ambiguous Food Match", () => {
    it("returns nutritionStatus 'ambiguous' and USDA candidates when query is uncertain", async () => {
      vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockResolvedValue(
        ambiguousFoodFixture.visionResult
      );

      vi.spyOn(NutritionLookupService.prototype, "lookupNutrition").mockResolvedValue({
        success: false,
        error: {
          type: "ambiguous_match",
          message: "Multiple potential matches found for soup",
          candidates: ambiguousFoodFixture.candidateMatches as any,
        },
      });

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.items[0].nutritionStatus).toBe("ambiguous");
      expect(json.data.items[0].candidates).toHaveLength(3);
      expect(json.data.items[0].candidates[0].foodName).toBe("Soup, vegetable broth");
    });
  });

  describe("Scenario 6: Nutrition Service / USDA API Failure", () => {
    it("gracefully isolates item-level nutrition error without failing the HTTP request", async () => {
      vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockResolvedValue(
        nutritionApiFailureFixture.visionResult
      );

      vi.spyOn(NutritionLookupService.prototype, "lookupNutrition").mockRejectedValue(
        new Error("USDA FoodData Central 503 Service Unavailable")
      );

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].nutritionStatus).toBe("error");
      expect(json.data.items[0].errorMessage).toContain("USDA FoodData Central 503");
    });
  });

  describe("Scenario 7: AI Vision Provider Failure", () => {
    it("returns HTTP 400 with structured error code when AI provider rejects", async () => {
      vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockRejectedValue(
        aiFailureFixture.visionError
      );

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("API_ERROR");
      expect(json.error.message).toContain("quota exceeded");
    });
  });

  describe("Scenario 8: Malformed Upload & Edge Cases", () => {
    it("returns 400 MISSING_IMAGE when no image field is in formData", async () => {
      const formData = new FormData();
      formData.append("other_field", "value");

      const request = new NextRequest("http://localhost:3000/api/analyze-food", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("MISSING_IMAGE");
    });

    it("returns 400 VALIDATION_ERROR when file has invalid MIME type or extension", async () => {
      const request = createMockRequest(
        Buffer.from("fake pdf"),
        "document.pdf",
        "application/pdf"
      );

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Step 3: Calibration & Geometry Fields", () => {
    describe("Scenario 9: Calibrated Marker Detected Fixture", () => {
      it("verifies mock provider returns detectedMarker when calibration enabled", async () => {
        vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockResolvedValue(
          calibratedMarkerDetectedFixture.visionResult
        );

        vi.spyOn(NutritionLookupService.prototype, "lookupNutrition").mockResolvedValue({
          success: true,
          data: singleFoodFixture.nutritionData,
        });

        const request = createMockRequest();
        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.items).toHaveLength(1);

        const item = json.data.items[0];
        // Verify geometry fields are present from the mock
        expect(item.nutrition).toBeDefined();
        expect(item.nutrition.massEstimationMethod).toBeDefined();
        expect(item.nutrition.estimatedGrams).toBeDefined();
        expect(item.nutrition.uncertaintyGrams).toBeDefined();
      });
    });

    describe("Scenario 10: Marker Too Low Confidence", () => {
      it("verifies mock provider generates low-confidence marker", async () => {
        vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockResolvedValue(
          markerLowConfidenceFixture.visionResult
        );

        vi.spyOn(NutritionLookupService.prototype, "lookupNutrition").mockResolvedValue({
          success: true,
          data: singleFoodFixture.nutritionData,
        });

        const request = createMockRequest();
        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        // Marker in fixture has confidence 0.35 (below 0.5 threshold)
        const visionResult = markerLowConfidenceFixture.visionResult;
        expect(visionResult.detectedMarker).toBeDefined();
        expect(visionResult.detectedMarker?.confidence).toBe(0.35);
      });
    });

    describe("Scenario 11: Marker Too Small", () => {
      it("verifies mock provider generates undersized marker", async () => {
        vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockResolvedValue(
          markerTooSmallFixture.visionResult
        );

        vi.spyOn(NutritionLookupService.prototype, "lookupNutrition").mockResolvedValue({
          success: true,
          data: singleFoodFixture.nutritionData,
        });

        const request = createMockRequest();
        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        // Marker in fixture is ~15px × ~15px (too small, < 20px)
        const visionResult = markerTooSmallFixture.visionResult;
        expect(visionResult.detectedMarker).toBeDefined();
        const [x1, y1, x2, y2] = visionResult.detectedMarker?.box2d || [];
        const width = x2 - x1;
        const height = y2 - y1;
        expect(width).toBeLessThan(20);
        expect(height).toBeLessThan(20);
      });
    });

    describe("Scenario 12: Marker Not Detected", () => {
      it("verifies mock provider handles missing marker gracefully", async () => {
        vi.spyOn(FoodAnalysisService.prototype, "analyzeFood").mockResolvedValue(
          uncalibratedMarkerNotDetectedFixture.visionResult
        );

        vi.spyOn(NutritionLookupService.prototype, "lookupNutrition").mockResolvedValue({
          success: true,
          data: singleFoodFixture.nutritionData,
        });

        const request = createMockRequest();
        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        // No marker should be present in the vision result
        const visionResult = uncalibratedMarkerNotDetectedFixture.visionResult;
        expect(visionResult.detectedMarker).toBeUndefined();
        // But nutrition should still be scaled to estimated portion
        expect(json.data.items[0].nutrition.estimatedGrams).toBeDefined();
      });
    });
  });
});
