/**
 * Unit Tests — FoodAnalysisService
 *
 * Tests the food recognition business logic layer:
 * 1. Image input validation (buffer length, MIME type, size limit)
 * 2. Confidence filtering (< 0.3 confidence items filtered out)
 * 3. Message generation when items are filtered
 * 4. Provider delegation and error propagation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FoodAnalysisService } from "../analysis-service";
import type { VisionProvider } from "../vision-provider";
import type { FoodRecognitionResult, FoodRecognitionError } from "../types";
import {
  singleFoodFixture,
  multipleFoodsFixture,
  noFoodFixture,
  malformedUploadFixtures,
} from "../../../test/fixtures/food-fixtures";

describe("FoodAnalysisService", () => {
  let mockVisionProvider: VisionProvider;
  let service: FoodAnalysisService;
  const validJpegBuffer = Buffer.from("fake-jpeg-binary-data");

  beforeEach(() => {
    mockVisionProvider = {
      analyzeFoodImage: vi.fn(),
    };
    service = new FoodAnalysisService(mockVisionProvider);
  });

  describe("Input Validation & Malformed Uploads", () => {
    it("rejects an empty image buffer", async () => {
      const { buffer, mimeType, expectedError } = malformedUploadFixtures.emptyBuffer;

      await expect(service.analyzeFood(buffer, mimeType)).rejects.toMatchObject({
        type: "invalid_image",
        message: expect.stringContaining(expectedError),
      });

      expect(mockVisionProvider.analyzeFoodImage).not.toHaveBeenCalled();
    });

    it("rejects unsupported MIME types", async () => {
      const { buffer, mimeType, expectedError } = malformedUploadFixtures.invalidMimeType;

      await expect(service.analyzeFood(buffer, mimeType)).rejects.toMatchObject({
        type: "invalid_image",
        message: expect.stringContaining(expectedError),
      });

      expect(mockVisionProvider.analyzeFoodImage).not.toHaveBeenCalled();
    });

    it("rejects oversized image buffers exceeding 20MB", async () => {
      const { buffer, mimeType, expectedError } = malformedUploadFixtures.oversizedBuffer;

      await expect(service.analyzeFood(buffer, mimeType)).rejects.toMatchObject({
        type: "invalid_image",
        message: expect.stringContaining(expectedError),
      });

      expect(mockVisionProvider.analyzeFoodImage).not.toHaveBeenCalled();
    });

    it("accepts supported image formats (jpeg, png, webp, heic)", async () => {
      vi.mocked(mockVisionProvider.analyzeFoodImage).mockResolvedValue(
        singleFoodFixture.visionResult
      );

      const supportedMimes = ["image/jpeg", "image/png", "image/webp", "image/heic"];

      for (const mime of supportedMimes) {
        const result = await service.analyzeFood(validJpegBuffer, mime);
        expect(result.items).toHaveLength(1);
      }
    });
  });

  describe("Confidence Handling & Filtering", () => {
    it("preserves high-confidence food items", async () => {
      vi.mocked(mockVisionProvider.analyzeFoodImage).mockResolvedValue(
        singleFoodFixture.visionResult
      );

      const result = await service.analyzeFood(validJpegBuffer, "image/jpeg");

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("banana");
      expect(result.items[0].confidence).toBe(0.95);
      expect(result.message).toBeUndefined();
    });

    it("filters out items with confidence below 0.3 threshold", async () => {
      const rawVisionResult: FoodRecognitionResult = {
        items: [
          {
            name: "Salad",
            canonicalName: "salad",
            confidence: 0.9,
            description: "Fresh green salad",
            estimatedPortion: "1 bowl",
          },
          {
            name: "Ghost Item",
            canonicalName: "unknown",
            confidence: 0.25, // Below 0.3 threshold
            description: "Barely visible speck",
            estimatedPortion: "trace",
          },
          {
            name: "Unclear Garnish",
            canonicalName: "herb",
            confidence: 0.15, // Below 0.3 threshold
            description: "Possible parsley flake",
            estimatedPortion: "pinch",
          },
        ],
        imageQuality: "good",
      };

      vi.mocked(mockVisionProvider.analyzeFoodImage).mockResolvedValue(rawVisionResult);

      const result = await service.analyzeFood(validJpegBuffer, "image/jpeg");

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Salad");
      expect(result.message).toContain("2 low-confidence item(s) filtered out");
    });

    it("keeps items with confidence exactly equal to 0.3", async () => {
      const borderlineResult: FoodRecognitionResult = {
        items: [
          {
            name: "Borderline Item",
            canonicalName: "item",
            confidence: 0.3,
            description: "Borderline item",
            estimatedPortion: "1 serving",
          },
        ],
        imageQuality: "poor",
      };

      vi.mocked(mockVisionProvider.analyzeFoodImage).mockResolvedValue(borderlineResult);

      const result = await service.analyzeFood(validJpegBuffer, "image/jpeg");

      expect(result.items).toHaveLength(1);
      expect(result.items[0].confidence).toBe(0.3);
      expect(result.message).toBeUndefined();
    });
  });

  describe("Multiple Foods & Empty Scenarios", () => {
    it("handles multiple recognized food items in a single image", async () => {
      vi.mocked(mockVisionProvider.analyzeFoodImage).mockResolvedValue(
        multipleFoodsFixture.visionResult
      );

      const result = await service.analyzeFood(validJpegBuffer, "image/jpeg");

      expect(result.items).toHaveLength(3);
      expect(result.items.map((i) => i.name)).toEqual([
        "Grilled Chicken Breast",
        "Steamed Broccoli",
        "Brown Rice",
      ]);
    });

    it("returns empty item list when non-food image is analyzed", async () => {
      vi.mocked(mockVisionProvider.analyzeFoodImage).mockResolvedValue(
        noFoodFixture.visionResult
      );

      const result = await service.analyzeFood(validJpegBuffer, "image/jpeg");

      expect(result.items).toHaveLength(0);
      expect(result.imageQuality).toBe("unrecognizable");
      expect(result.message).toBe("No food items detected in the image.");
    });
  });

  describe("Provider Error Propagation", () => {
    it("propagates AI vision provider errors cleanly", async () => {
      const errorToThrow: FoodRecognitionError = {
        type: "api_error",
        message: "Gemini API rate limit exceeded",
      };

      vi.mocked(mockVisionProvider.analyzeFoodImage).mockRejectedValue(errorToThrow);

      await expect(service.analyzeFood(validJpegBuffer, "image/jpeg")).rejects.toMatchObject({
        type: "api_error",
        message: "Gemini API rate limit exceeded",
      });
    });
  });
});
