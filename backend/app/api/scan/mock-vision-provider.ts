import type { VisionProvider } from "@/lib/food/vision-provider";
import type { FoodRecognitionResult, FoodRecognitionError, DetectedMarker, FoodItem } from "@/lib/food/types";

/**
 * Mock Vision Provider
 *
 * This is a MOCK implementation of VisionProvider for development and testing.
 *
 * Why use a mock?
 * 1. Development: We can test the API without spending money on Gemini API calls
 * 2. Testing: We can write automated tests that don't depend on external APIs
 * 3. Offline work: We can develop even when internet is unavailable
 *
 * When to use:
 * - During initial development (before we have a Gemini API key)
 * - In unit tests
 * - When we want deterministic, predictable responses
 *
 * Later, we'll replace this with the real GeminiVisionProvider.
 */

/**
 * Test scenario types for MockVisionProvider
 * Allows configurable responses for different test cases.
 */
export type MockScenario =
  | "single_banana_calibrated_marker"
  | "single_banana_uncalibrated"
  | "single_banana_marker_too_low_confidence"
  | "single_banana_marker_too_small"
  | "multiple_foods_mixed_geometry"
  | "no_food_detected";

export class MockVisionProvider implements VisionProvider {
  private scenario: MockScenario;

  constructor(scenario: MockScenario = "single_banana_calibrated_marker") {
    this.scenario = scenario;
  }

  /**
   * Analyze a food image and return mock recognition results.
   *
   * Supports multiple scenarios for testing:
   * - single_banana_calibrated_marker: Banana with high-confidence marker detected
   * - single_banana_uncalibrated: Banana without marker detection
   * - single_banana_marker_too_low_confidence: Marker found but confidence < 0.5 (rejected by calibration)
   * - single_banana_marker_too_small: Marker found but size < 20px (rejected by calibration)
   * - multiple_foods_mixed_geometry: Mix of discrete units and volume-based foods
   * - no_food_detected: Empty result, non-food image
   */
  async analyzeFoodImage(
    _image: Buffer,
    _mimeType: string,
    _calibrationContext?: any
  ): Promise<FoodRecognitionResult> {
    // Simulate a small delay to make it feel like a real API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    const calibrationEnabled = _calibrationContext?.referenceCalibration?.enabled ?? false;

    switch (this.scenario) {
      case "single_banana_calibrated_marker":
        return this.buildBananaWithMarker(calibrationEnabled, "high_confidence");

      case "single_banana_uncalibrated":
        return this.buildBananaWithMarker(calibrationEnabled, "no_marker");

      case "single_banana_marker_too_low_confidence":
        return this.buildBananaWithMarker(calibrationEnabled, "low_confidence");

      case "single_banana_marker_too_small":
        return this.buildBananaWithMarker(calibrationEnabled, "too_small");

      case "multiple_foods_mixed_geometry":
        return this.buildMultipleFoods();

      case "no_food_detected":
        return {
          items: [],
          imageQuality: "unrecognizable",
          message: "No food items detected in this image.",
        };

      default:
        return this.buildBananaWithMarker(calibrationEnabled, "high_confidence");
    }
  }

  /**
   * Factory: Build a banana item with optional marker detection
   */
  private buildBananaWithMarker(
    calibrationEnabled: boolean,
    markerState: "high_confidence" | "low_confidence" | "too_small" | "no_marker"
  ): FoodRecognitionResult {
    const bananaItem: FoodItem = {
      name: "banana",
      canonicalName: "Banana, raw",
      confidence: 0.94,
      description: "Ripe yellow banana, medium size",
      estimatedPortion: "1 medium (118g)",
      // Geometry fields always present in mock (optional in schema)
      foodGeometryCategory: "discrete_unit",
      sizeTier: "medium",
      itemCount: 1,
      box2d: [100, 150, 400, 350],
    };

    let detectedMarker: DetectedMarker | undefined;

    if (calibrationEnabled) {
      switch (markerState) {
        case "high_confidence":
          // High-confidence, valid-sized marker that passes calibration
          detectedMarker = {
            markerType: "credit_card",
            confidence: 0.87,
            box2d: [50, 50, 150, 300], // ~100px × ~250px (valid size, ≥20px)
          };
          break;

        case "low_confidence":
          // Marker detected but confidence < 0.5 (will be rejected by calibration)
          detectedMarker = {
            markerType: "us_quarter",
            confidence: 0.35,
            box2d: [60, 60, 140, 140],
          };
          break;

        case "too_small":
          // Marker detected but size < 20px (will be rejected by calibration)
          detectedMarker = {
            markerType: "us_penny",
            confidence: 0.72,
            box2d: [100, 100, 115, 115], // ~15px × ~15px (too small)
          };
          break;

        case "no_marker":
          // No marker detected
          detectedMarker = undefined;
          break;
      }
    }

    return {
      items: [bananaItem],
      imageQuality: "good",
      message: "Mock response: Simulated food recognition result for testing.",
      detectedMarker,
    };
  }

  /**
   * Factory: Build multiple foods with mixed geometry categories
   */
  private buildMultipleFoods(): FoodRecognitionResult {
    return {
      items: [
        {
          name: "grilled chicken breast",
          canonicalName: "Chicken breast, cooked",
          confidence: 0.91,
          description: "Grilled chicken breast fillet",
          estimatedPortion: "1 breast (150g)",
          foodGeometryCategory: "solid_slab",
          sizeTier: "large",
          itemCount: 1,
          box2d: [50, 100, 350, 400],
        },
        {
          name: "brown rice",
          canonicalName: "Rice, brown, cooked",
          confidence: 0.85,
          description: "Mound of cooked brown rice",
          estimatedPortion: "1 cup (195g)",
          foodGeometryCategory: "amorphous_mound",
          sizeTier: "medium",
          heightProfile: "medium_dome",
          itemCount: 1,
          box2d: [150, 200, 450, 500],
        },
        {
          name: "vegetable soup",
          canonicalName: "Soup, vegetable, homemade",
          confidence: 0.78,
          description: "Bowl of mixed vegetable soup",
          estimatedPortion: "1 bowl (300g)",
          foodGeometryCategory: "liquid_or_bowl",
          sizeTier: "large",
          heightProfile: "deep_bowl",
          itemCount: 1,
          box2d: [200, 150, 600, 450],
        },
      ],
      imageQuality: "good",
      message: "Mock response: Multiple foods with varied geometry.",
    };
  }
}