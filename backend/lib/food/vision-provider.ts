import type { FoodRecognitionResult } from "./types";
import type { CaptureMetadata } from "@/lib/validation/schemas";

/**
 * VisionProvider Interface
 *
 * This is an ABSTRACTION — it defines what any food recognition provider must be able to do,
 * without specifying HOW it does it.
 *
 * Why this matters:
 * - The rest of the backend depends on THIS interface, not on a specific provider (Gemini, OpenAI, etc.)
 * - We can swap providers by writing a new class that implements this interface
 * - We can test the backend with a mock provider that returns fake data
 * - We can A/B test multiple providers without changing route handler code
 *
 * This pattern is called "Dependency Inversion" — high-level code depends on abstractions,
 * not on concrete implementations.
 */
export interface VisionProvider {
  /**
   * Analyze a food image and return structured recognition results.
   *
   * @param image - The image data as a Buffer (raw bytes)
   * @param mimeType - The image MIME type (e.g., "image/jpeg", "image/png")
   * @param calibrationContext - Optional capture metadata containing reference calibration info.
   *                             When provided, the vision model should attempt to detect
   *                             reference markers and include geometry + bounding box info
   *                             in the response. Null or undefined means no calibration context available.
   * @returns A promise that resolves to structured food recognition results
   * @throws {FoodRecognitionError} if the analysis fails
   *
   * IMPORTANT: This method should ONLY identify food items.
   * It must NEVER generate calorie counts, macros, or any nutritional values.
   * Nutrition data comes from USDA or another trusted source, not from AI inference.
   */
  analyzeFoodImage(
    image: Buffer,
    mimeType: string,
    calibrationContext?: CaptureMetadata | null
  ): Promise<FoodRecognitionResult>;
}
