import type { VisionProvider } from "./vision-provider";
import type { FoodRecognitionResult, FoodRecognitionError } from "./types";

/**
 * Food Analysis Service
 *
 * This is the SERVICE LAYER — it orchestrates the business logic of food analysis.
 * It depends on the VisionProvider interface, not on a specific implementation.
 *
 * Why this layer exists:
 * 1. Separates business logic from HTTP concerns (route handler deals with HTTP, this deals with food)
 * 2. Can be reused from multiple places (different endpoints, background jobs, tests)
 * 3. Can be tested independently by injecting a mock VisionProvider
 * 4. Can add caching, logging, or other cross-cutting concerns here
 *
 * Dependency flow:
 * Route Handler → FoodAnalysisService → VisionProvider → GeminiVisionProvider
 */
export class FoodAnalysisService {
  private visionProvider: VisionProvider;

  /**
   * Create a new FoodAnalysisService.
   *
   * @param visionProvider - Any object that implements the VisionProvider interface
   *                         This could be GeminiVisionProvider, OpenAIVisionProvider, or a mock for testing
   */
  constructor(visionProvider: VisionProvider) {
    this.visionProvider = visionProvider;
  }

  /**
   * Analyze a food image and return structured recognition results.
   *
   * This method is the main entry point for food analysis.
   * It delegates to the vision provider and can add additional processing.
   *
   * @param image - The image data as a Buffer
   * @param mimeType - The image MIME type (e.g., "image/jpeg")
   * @returns Structured food recognition results
   */
  async analyzeFood(
    image: Buffer,
    mimeType: string
  ): Promise<FoodRecognitionResult> {
    // Validate inputs
    this.validateImageInput(image, mimeType);

    // Call the vision provider (could be Gemini, OpenAI, etc.)
    const result = await this.visionProvider.analyzeFoodImage(image, mimeType);

    // Post-processing: filter out very low-confidence items
    // We don't want to show items the AI is very uncertain about
    const filteredItems = result.items.filter((item) => item.confidence >= 0.3);

    // If we filtered out items, add a note
    const removedCount = result.items.length - filteredItems.length;
    const message =
      removedCount > 0
        ? `${removedCount} low-confidence item(s) filtered out. ${result.message || ""}`
        : result.message;

    return {
      ...result,
      items: filteredItems,
      message,
    };
  }

  /**
   * Validate image input before processing.
   *
   * This is a guard clause to fail fast if the input is invalid.
   */
  private validateImageInput(image: Buffer, mimeType: string): void {
    // Check if image buffer is empty
    if (!image || image.length === 0) {
      throw {
        type: "invalid_image",
        message: "Image buffer is empty",
      } as FoodRecognitionError;
    }

    // Check if MIME type is valid
    const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!validMimeTypes.includes(mimeType)) {
      throw {
        type: "invalid_image",
        message: `Unsupported image type: ${mimeType}. Supported types: ${validMimeTypes.join(", ")}`,
      } as FoodRecognitionError;
    }

    // Check image size (max 20MB to avoid timeout issues)
    const maxSizeBytes = 20 * 1024 * 1024; // 20MB
    if (image.length > maxSizeBytes) {
      throw {
        type: "invalid_image",
        message: `Image too large: ${(image.length / 1024 / 1024).toFixed(2)}MB. Maximum size: 20MB`,
      } as FoodRecognitionError;
    }
  }
}
