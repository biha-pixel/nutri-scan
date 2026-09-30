import OpenAI from "openai";
import type { VisionProvider } from "./vision-provider";
import type { FoodRecognitionResult, FoodRecognitionError } from "./types";
import { GeminiResponseSchema } from "./schemas";

/**
 * Gemini Vision Provider (via OmniRoute)
 *
 * This class implements the VisionProvider interface using an OpenAI-compatible
 * API proxy (OmniRoute) that routes requests to Gemini models.
 *
 * WHY OPENAI-COMPATIBLE?
 * OmniRoute exposes Gemini models through an OpenAI-compatible API format.
 * This means we use the OpenAI SDK, but point it at OmniRoute's base URL.
 * The requests are forwarded to the actual Gemini models behind the scenes.
 *
 * IMPORTANT SECURITY NOTES:
 * 1. The API key must ONLY be stored in server-side environment variables.
 * 2. This class must NEVER be imported or used in the mobile app.
 * 3. The mobile app calls our backend API, and the backend uses this provider.
 * 4. We never log the API key or image data.
 *
 * WHAT THIS PROVIDER DOES:
 * - Identifies food items in an image
 * - Returns structured JSON with names, confidence scores, and portion estimates
 *
 * WHAT THIS PROVIDER DOES NOT DO:
 * - Generate calorie counts, macros, or any nutritional values
 * - Nutrition data comes from USDA, not from AI inference
 */
export class GeminiVisionProvider implements VisionProvider {
  private client: OpenAI;
  private model: string;
  private maxRetries: number;
  private baseDelayMs: number;

  /**
   * Create a new GeminiVisionProvider.
   *
   * @param apiKey      - The OmniRoute API key (from environment variable, NEVER from client)
   * @param baseURL     - The OmniRoute base URL (e.g., "http://localhost:20128")
   * @param model       - The model identifier on OmniRoute (e.g., "gemini")
   * @param maxRetries  - Maximum retry attempts before giving up (default: 5)
   * @param baseDelayMs - Base delay in milliseconds for exponential backoff (default: 1000)
   */
  constructor(
    apiKey: string,
    baseURL: string,
    model: string,
    maxRetries: number = 5,
    baseDelayMs: number = 1000
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.model = model;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
  }

  /**
   * Analyze a food image and return structured recognition results.
   *
   * Retries automatically if:
   * - The model returns an error (quota, unavailable, etc.)
   * - The response cannot be parsed as valid JSON
   * - The JSON fails Zod schema validation
   *
   * Each retry gives OmniRoute another chance to route to a different,
   * working model in your combo pool.
   *
   * @param image - The image data as a Buffer
   * @param mimeType - The image MIME type (e.g., "image/jpeg")
   * @returns Structured food recognition results
   */
  async analyzeFoodImage(
    image: Buffer,
    mimeType: string
  ): Promise<FoodRecognitionResult> {
    const base64Image = image.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    let lastError: FoodRecognitionError | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(
          `[VisionProvider] Attempt ${attempt}/${this.maxRetries} calling model "${this.model}"...`
        );

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: this.buildPrompt() },
                {
                  type: "image_url",
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
          max_tokens: 2048,
        });

        const responseText = response.choices[0]?.message?.content;

        if (!responseText) {
          throw {
            type: "api_error",
            message: `Attempt ${attempt}: No response content received from vision model`,
          } as FoodRecognitionError;
        }

        // Try to parse and validate. If this throws, the catch block
        // will trigger a retry with the next model in OmniRoute's pool.
        const result = this.parseAndValidateResponse(responseText);
        console.log(`[VisionProvider] Attempt ${attempt} succeeded.`);
        return result;
      } catch (error) {
        // Record the error for this attempt
        if (this.isFoodRecognitionError(error)) {
          lastError = error;
        } else {
          lastError = {
            type: "api_error",
            message: `Attempt ${attempt}: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }

        console.warn(
          `[VisionProvider] Attempt ${attempt}/${this.maxRetries} failed: ${lastError.message}`
        );

        // If we have retries left, wait with exponential backoff before trying again
        if (attempt < this.maxRetries) {
          const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`[VisionProvider] Waiting ${delay}ms before next attempt (allows OmniRoute model rotation)...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    console.error(`[VisionProvider] All ${this.maxRetries} attempts failed.`);
    throw (
      lastError || {
        type: "api_error",
        message: `All ${this.maxRetries} attempts failed to produce valid food recognition data.`,
      }
    );
  }

  /**
   * Helper to pause execution for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Build the prompt for the vision model.
   *
   * This prompt is carefully designed to:
   * 1. Ask for structured JSON output
   * 2. Only identify food, NOT generate nutrition facts
   * 3. Include confidence scores
   * 4. Handle uncertainty explicitly
   */
  private buildPrompt(): string {
    return `You are a food identification assistant. Analyze this image and identify ALL visible food items.

IMPORTANT RULES:
1. ONLY identify food items - do NOT generate calorie counts, macronutrients, or any nutritional values
2. If you cannot confidently identify an item, say so
3. Distinguish food from non-food objects (plates, utensils, etc. are NOT food)
4. Return your response as valid JSON matching this exact schema:

{
  "items": [
    {
      "name": "common name of the food (e.g., 'banana', 'grilled chicken')",
      "canonicalName": "standardized name for lookup (e.g., 'Banana, raw', 'Chicken, broilers or fryers, grilled')",
      "confidence": 0.0 to 1.0,
      "description": "brief description (e.g., 'ripe yellow banana', 'grilled chicken breast')",
      "estimatedPortion": "rough estimate (e.g., '1 medium', '100g', '1 cup') - this is NOT precise"
    }
  ],
  "imageQuality": "good" | "poor" | "unrecognizable",
  "message": "optional explanation if image quality is poor or no food is detected"
}

GUIDELINES:
- Confidence 0.9-1.0: Very confident in identification
- Confidence 0.7-0.9: Confident but some uncertainty
- Confidence 0.5-0.7: Uncertain - may need user verification
- Confidence below 0.5: Very uncertain - likely should not be included

If multiple food items are present, identify ALL of them.
If no food is visible, return an empty items array with imageQuality "unrecognizable".
Do NOT invent or hallucinate food items that are not clearly visible.

Return ONLY the JSON object, no other text.`;
  }

  /**
   * Parse and validate the model response.
   *
   * We validate with Zod because we cannot trust that the AI will always
   * return perfectly formatted JSON.
   */
  private parseAndValidateResponse(
    responseText: string
  ): FoodRecognitionResult {
    try {
      // Attempt to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw {
          type: "validation_error",
          message: "No valid JSON found in AI response",
        } as FoodRecognitionError;
      }

      // Parse the JSON
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate against our Zod schema
      const validationResult = GeminiResponseSchema.safeParse(parsed);

      if (!validationResult.success) {
        throw {
          type: "validation_error",
          message: `AI response validation failed: ${validationResult.error.message}`,
        } as FoodRecognitionError;
      }

      // Return the validated result
      return validationResult.data;
    } catch (error) {
      if (this.isFoodRecognitionError(error)) {
        throw error;
      }

      throw {
        type: "validation_error",
        message: `Failed to parse AI response: ${error instanceof Error ? error.message : "Unknown parsing error"}`,
      } as FoodRecognitionError;
    }
  }

  /**
   * Type guard to check if an error is a FoodRecognitionError.
   */
  private isFoodRecognitionError(error: unknown): error is FoodRecognitionError {
    return (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      "message" in error
    );
  }
}
