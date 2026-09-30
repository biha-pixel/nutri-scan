import type { VisionProvider } from "@/lib/food/vision-provider";
import type { FoodRecognitionResult, FoodRecognitionError } from "@/lib/food/types";

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
export class MockVisionProvider implements VisionProvider {
  /**
   * Analyze a food image and return mock recognition results.
   *
   * This always returns a predictable response for development.
   */
  async analyzeFoodImage(
    _image: Buffer,
    _mimeType: string
  ): Promise<FoodRecognitionResult> {
    // Simulate a small delay to make it feel like a real API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Return mock food recognition results
    // In a real implementation, this would call Gemini API
    return {
      items: [
        {
          name: "banana",
          canonicalName: "Banana, raw",
          confidence: 0.94,
          description: "Ripe yellow banana, medium size",
          estimatedPortion: "1 medium (118g)",
        },
      ],
      imageQuality: "good",
      message: "Mock response: This is a simulated food recognition result for development.",
    };
  }
}