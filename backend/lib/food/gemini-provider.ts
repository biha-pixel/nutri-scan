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
   * @param calibrationContext - Optional capture metadata with reference calibration info.
   *                             When provided, instructs Gemini to detect markers and return geometry.
   * @returns Structured food recognition results
   */
  async analyzeFoodImage(
    image: Buffer,
    mimeType: string,
    calibrationContext?: any
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
                { type: "text", text: this.buildPrompt(calibrationContext) },
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

        // Log the raw response for debugging
        console.log(`[VisionProvider] Attempt ${attempt} raw response (first 500 chars): ${responseText.substring(0, 500)}`);

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
   * 5. When calibration context is available, request geometry and bounding box data
   * 6. Attempt to detect reference markers for scale calibration
   */
  private buildPrompt(calibrationContext?: any): string {
    const basePrompt = `You must respond with ONLY valid JSON. No other text before, after, or inside.

Analyze this food image and return JSON:

{
  "items": [
    {
      "name": "banana",
      "canonicalName": "Banana, raw",
      "confidence": 0.95,
      "description": "ripe yellow banana",
      "estimatedPortion": "1 medium",
      "estimatedGrams": 118,
      "foodGeometryCategory": "discrete_unit",
      "sizeTier": "medium",
      "heightProfile": "curved",
      "itemCount": 1,
      "visualScaleCue": "typical banana size",
      "box2d": [150, 200, 500, 700]
    }
  ],
  "imageQuality": "good",
  "message": "",
  "detectedMarker": null
}

INSTRUCTIONS:
- Identify all visible food items ONLY (not plates, utensils, hands)
- confidence: 0.9-1.0 very sure, 0.7-0.9 sure, 0.5-0.7 uncertain, <0.5 don't include
- If no food found: items=[], imageQuality="unrecognizable"
- If image is blurry/dark: items=[], imageQuality="poor"
- NEVER invent food. NEVER generate nutrition facts.
- Return ONLY the JSON object. Start with { and end with }. Nothing else.`;

    if (calibrationContext) {
      return `${basePrompt}

CALIBRATION CONTEXT AVAILABLE:
- Capture mode: ${calibrationContext.captureMode || 'unknown'}
- Reference calibration: ${calibrationContext.referenceCalibration?.enabled ? 'enabled' : 'disabled'}
${
  calibrationContext.referenceCalibration?.enabled
    ? `- Marker type: ${calibrationContext.referenceCalibration.selectedMarkerType || 'unknown'}`
    : ''
}

When calibration is enabled, please:
1. Attempt to detect the reference marker in the image
2. Provide geometry data (foodGeometryCategory, estimatedGrams, box2d) for each food item
3. Report the detected marker type and bounding box if found
4. Use the reference marker to estimate physical scale if possible`;
    }

    return basePrompt;
  }

  /**
   * Parse and validate the model response.
   *
   * This parser is resilient to common formatting issues:
   * - Markdown code fences (```json ... ```)
   * - Leading/trailing whitespace
   * - Incomplete or malformed JSON
   *
   * We validate with Zod because we cannot trust that the AI will always
   * return perfectly formatted JSON. Optional geometry fields are allowed
   * and will be undefined if not present.
   */
  private parseAndValidateResponse(
    responseText: string
  ): FoodRecognitionResult {
    try {
      // Log the raw response for debugging
      console.log(`[VisionProvider] Raw response length: ${responseText.length}`);
      console.log(`[VisionProvider] Raw response (first 800 chars): ${responseText.substring(0, 800)}`);

      // Strip markdown code fences if present
      let cleaned = responseText.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/```\s*$/, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "");
      }
      cleaned = cleaned.trim();

      // Attempt to extract JSON from the response
      // Match the outermost { ... } to handle cases where text precedes or follows the JSON
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`[VisionProvider] Failed to extract JSON. Cleaned response: ${cleaned.substring(0, 500)}`);
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
