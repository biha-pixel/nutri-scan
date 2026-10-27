import { NextRequest, NextResponse } from "next/server";
import { FoodAnalysisService } from "@/lib/food/analysis-service";
import { GeminiVisionProvider } from "@/lib/food/gemini-provider";
import { MockVisionProvider } from "../scan/mock-vision-provider";
import { USDANutritionProvider } from "@/lib/nutrition/usda-provider";
import { NutritionLookupService } from "@/lib/nutrition/nutrition-service";
import { NutritionHighlightService } from "@/lib/highlights/highlights-service";
import { ImageUploadSchema, CaptureMetadataSchema } from "@/lib/validation/schemas";
import { validateImageFileHeader } from "@/lib/validation/file-validation";
import { attemptScaleCalibration, attachCalibrationToResult } from "@/lib/calibration/scale-calibration";
import { estimateFoodMass, scaleNutritionToMass } from "@/lib/nutrition/portion-mass-estimator";
import { extractClientIp } from "@/lib/security/ip-extractor";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import type { CaptureMetadata } from "@/lib/validation/schemas";
import type { CalibrationSummary } from "@/lib/calibration/scale-calibration";
import type { VisionProvider } from "@/lib/food/vision-provider";
import type { NutritionData, NutritionSearchResult } from "@/lib/nutrition/types";
import type { NutritionHighlight } from "@/lib/highlights/types";

/**
 * Full Analyzed Item Structure returned by the unified /api/analyze-food endpoint.
 */
export interface AnalyzedFoodItem {
  name: string;
  canonicalName: string;
  confidence: number;
  description: string;
  estimatedPortion: string;
  nutritionStatus: "found" | "ambiguous" | "not_found" | "unavailable" | "error";
  nutrition: NutritionData | null;
  highlights: NutritionHighlight[];
  candidates?: NutritionSearchResult[];
  errorMessage?: string;
}

export interface FoodAnalysisResponseData {
  items: AnalyzedFoodItem[];
  imageQuality: "good" | "poor" | "unrecognizable";
  message?: string;
  analyzedAt: string;
  calibration?: CalibrationSummary;
}

export interface AnalyzeFoodSuccessResponse {
  success: true;
  data: FoodAnalysisResponseData;
}

export interface AnalyzeFoodErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type AnalyzeFoodApiResponse = AnalyzeFoodSuccessResponse | AnalyzeFoodErrorResponse;

// Factory for VisionProvider
function createVisionProvider(): VisionProvider {
  const apiKey = process.env.OMNIROUTE_API_KEY;
  const baseURL = process.env.OMNIROUTE_BASE_URL;
  const model = process.env.OMNIROUTE_MODEL;
  const maxRetries = process.env.OMNIROUTE_MAX_RETRIES
    ? parseInt(process.env.OMNIROUTE_MAX_RETRIES, 10)
    : 5;
  const retryDelay = process.env.OMNIROUTE_RETRY_DELAY
    ? parseInt(process.env.OMNIROUTE_RETRY_DELAY, 10)
    : 1000;

  if (apiKey && baseURL && model) {
    return new GeminiVisionProvider(apiKey, baseURL, model, maxRetries, retryDelay);
  }

  console.warn(
    "[/api/analyze-food] OmniRoute env vars not fully set — using MockVisionProvider."
  );
  return new MockVisionProvider();
}

// Singletons / Service instances
const visionProvider = createVisionProvider();
const foodAnalysisService = new FoodAnalysisService(visionProvider);

const usdaApiKey = process.env.USDA_API_KEY || "DEMO_KEY";
const usdaProvider = new USDANutritionProvider(usdaApiKey);
const nutritionLookupService = new NutritionLookupService(usdaProvider);
const highlightService = new NutritionHighlightService();

/**
 * Extract and validate optional capture metadata from the request.
 *
 * The mobile app sends metadata two ways (depending on platform):
 * - Web path: FormData field "captureMetadata" (plain JSON string)
 * - Native path: X-Capture-Metadata header (URL-encoded JSON string via encodeURIComponent)
 *
 * GRACEFUL MODE: If metadata is present but malformed, log a warning and return undefined.
 * The scan proceeds uncalibrated rather than failing the entire food analysis.
 *
 * @returns Validated CaptureMetadata if present and valid, undefined if absent or invalid.
 */
function extractCaptureMetadata(
  request: NextRequest,
  formData: FormData
): CaptureMetadata | undefined {
  let rawJson: string | undefined;

  // Priority 1: Check FormData field (web uploads)
  const formField = formData.get("captureMetadata");
  if (formField && typeof formField === "string" && formField.trim() !== "") {
    rawJson = formField;
  }

  // Priority 2: Check X-Capture-Metadata header (native uploads via Expo File API)
  if (!rawJson) {
    const headerValue = request.headers.get("X-Capture-Metadata");
    if (headerValue && headerValue.trim() !== "") {
      try {
        rawJson = decodeURIComponent(headerValue);
      } catch (decodeError) {
        console.warn("[analyze-food] Failed to URL-decode X-Capture-Metadata header — proceeding uncalibrated:", decodeError);
        return undefined;
      }
    }
  }

  // No metadata provided — perfectly valid, metadata is optional
  if (!rawJson) {
    return undefined;
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (parseError) {
    console.warn("[analyze-food] Failed to parse capture metadata JSON — proceeding uncalibrated:", parseError);
    return undefined;
  }

  // Validate against schema — GRACEFULLY FALLBACK on failure
  const validation = CaptureMetadataSchema.safeParse(parsed);
  if (!validation.success) {
    console.warn(
      "[analyze-food] Capture metadata failed validation — proceeding uncalibrated:",
      validation.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
    );
    return undefined;
  }

  return validation.data;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalyzeFoodApiResponse>> {
  try {
    // 0. Rate Limiting Check
    const clientIp = extractClientIp(request);
    const rateLimitCheck = checkRateLimit(clientIp, 'analyze_food');
    if (!rateLimitCheck.allowed) {
      const retryAfter = rateLimitCheck.retryAfter || 60;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          },
        },
        {
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() }
        }
      );
    }

    // 1. Parse Multipart Form Data
    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (!imageFile) {
      console.error(`[analyze-food] 400 Validation Error: MISSING_IMAGE | No image file in formData`);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_IMAGE",
            message: "No image file provided. Please upload an image.",
          },
        },
        { status: 400 }
      );
    }

    if (!(imageFile instanceof File)) {
      console.error(`[analyze-food] 400 Validation Error: INVALID_IMAGE | formData.get("image") is not a File instance | type=${typeof imageFile}`);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_IMAGE",
            message: "The uploaded file is not a valid image file.",
          },
        },
        { status: 400 }
      );
    }

    // 2. Validate input with Zod
    const validation = ImageUploadSchema.safeParse({
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type,
    });

    if (!validation.success) {
      console.error(`[analyze-food] 400 Validation Error: VALIDATION_ERROR | file="${imageFile.name}" type="${imageFile.type}" size=${imageFile.size} errors=${validation.error.errors.map((e) => e.message).join(", ")}`);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.error.errors.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    // 3. Convert image to Buffer and validate magic bytes
    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Log first 8 hex bytes for debugging
    const hexBytes = imageBuffer.slice(0, 8).toString('hex').toUpperCase();
    const fileName = imageFile.name || 'unknown';
    const fileType = imageFile.type || 'unknown';
    const fileSize = imageFile.size || 0;

    // Check magic bytes to prevent spoofed non-image files
    const detectedMimeType = validateImageFileHeader(imageBuffer.slice(0, 16));
    if (!detectedMimeType) {
      console.error(`[analyze-food] 400 Validation Error: Invalid magic bytes | file="${fileName}" type="${fileType}" size=${fileSize} hex="${hexBytes}"`);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_IMAGE_FORMAT',
            message: 'The uploaded file does not appear to be a valid image. Please check the file and try again.',
          },
        },
        { status: 400 }
      );
    }

    // Use detected MIME type if client type is generic/unknown
    const mimeType = detectedMimeType || imageFile.type || "image/jpeg";

    // 4. Extract optional capture metadata - GRACEFUL: fallback to undefined on validation failure
    const captureMetadata = extractCaptureMetadata(request, formData);

    if (captureMetadata) {
      console.log(
        `[analyze-food] Capture metadata: mode=${captureMetadata.captureMode}, ` +
        `dimensions=${captureMetadata.imageWidthPx}x${captureMetadata.imageHeightPx}, ` +
        `calibration=${captureMetadata.referenceCalibration.enabled ? "enabled" : "disabled"}`
      );
    }

    // 5. AI Food Recognition via Vision Provider
    const visionStartTime = Date.now();
    console.log("[analyze-food] Analyzing image with VisionProvider...");
    const recognitionResult = await foodAnalysisService.analyzeFood(
      imageBuffer,
      mimeType,
      captureMetadata
    );
    const visionDuration = Date.now() - visionStartTime;
    console.log(`[analyze-food] Vision analysis completed in ${visionDuration}ms. Items detected: ${recognitionResult.items.length}, Quality: ${recognitionResult.imageQuality}`);

    if (
      !recognitionResult.items ||
      recognitionResult.items.length === 0 ||
      recognitionResult.imageQuality === "unrecognizable"
    ) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          imageQuality: recognitionResult.imageQuality,
          message:
            recognitionResult.message ||
            "No food items could be detected in this photo. Please try another angle or better lighting.",
          analyzedAt: new Date().toISOString(),
        },
      });
    }

    // 5a. Attempt 2D scale calibration if enabled (before nutrition lookup)
    let calibrationSummary: CalibrationSummary | undefined;
    if (captureMetadata?.referenceCalibration.enabled) {
      console.log("[analyze-food] Attempting scale calibration...");
      calibrationSummary = attemptScaleCalibration(recognitionResult, captureMetadata);
      console.log(`[analyze-food] Calibration result: ${calibrationSummary.validationStatus}`);
    }

    // 5b. Lookup Nutrition & Highlights for each item in parallel with Promise.allSettled
    console.log(
      `[analyze-food] Identified ${recognitionResult.items.length} item(s). Looking up nutrition...`
    );

    const settledResults = await Promise.allSettled(
      recognitionResult.items.map(async (item): Promise<AnalyzedFoodItem> => {
        const query = item.canonicalName || item.name;
        try {
          // Step 1: Estimate portion mass using calibration if available
          const massEstimate = estimateFoodMass(
            item,
            calibrationSummary,
            captureMetadata?.imageWidthPx ?? 1200,
            captureMetadata?.imageHeightPx ?? 1600
          );

          console.log(
            `[analyze-food] Mass estimate for ${item.name}: ${massEstimate.estimatedGrams}g ` +
            `(±${massEstimate.uncertaintyGrams}g, method: ${massEstimate.estimationMethod})`
          );

          // Attempt lookup with canonical name first
          let lookupResult = await nutritionLookupService.lookupNutrition(query);

          // If canonical lookup yielded not_found and common name is distinct, try fallback search
          if (
            !lookupResult.success &&
            lookupResult.error.type === "not_found" &&
            item.name &&
            item.name.toLowerCase() !== query.toLowerCase()
          ) {
            console.log(
              `[analyze-food] Canonical lookup failed for "${query}". Falling back to common name "${item.name}"...`
            );
            lookupResult = await nutritionLookupService.lookupNutrition(item.name);
          }

          if (lookupResult.success) {
            // Step 2: Scale nutrition data to the estimated portion mass
            const scaledNutrition = scaleNutritionToMass(
              lookupResult.data,
              massEstimate.estimatedGrams,
              massEstimate.estimationMethod,
              massEstimate.uncertaintyGrams
            );

            // Generate deterministic educational highlights from the scaled nutrition data
            const highlights = highlightService.generateHighlights(scaledNutrition);

            return {
              name: item.name,
              canonicalName: item.canonicalName,
              confidence: item.confidence,
              description: item.description,
              estimatedPortion: `${massEstimate.estimatedGrams}g (${massEstimate.confidence})`,
              nutritionStatus: "found",
              nutrition: scaledNutrition,
              highlights,
            };
          } else {
            // Lookup failed with a structured domain error (e.g. ambiguous or not_found)
            const err = lookupResult.error;
            if (err.type === "ambiguous_match") {
              return {
                name: item.name,
                canonicalName: item.canonicalName,
                confidence: item.confidence,
                description: item.description,
                estimatedPortion: `${massEstimate.estimatedGrams}g (estimated)`,
                nutritionStatus: "ambiguous",
                nutrition: null,
                highlights: [],
                candidates: err.candidates,
                errorMessage: err.message,
              };
            }

            return {
              name: item.name,
              canonicalName: item.canonicalName,
              confidence: item.confidence,
              description: item.description,
              estimatedPortion: `${massEstimate.estimatedGrams}g (estimated)`,
              nutritionStatus: "not_found",
              nutrition: null,
              highlights: [],
              errorMessage: err.message,
            };
          }
        } catch (itemError) {
          console.error(`[analyze-food] Error resolving nutrition for ${query}:`, itemError);

          // Estimate mass even if nutrition lookup fails
          const massEstimate = estimateFoodMass(
            item,
            calibrationSummary,
            captureMetadata?.imageWidthPx ?? 1200,
            captureMetadata?.imageHeightPx ?? 1600
          );

          return {
            name: item.name,
            canonicalName: item.canonicalName,
            confidence: item.confidence,
            description: item.description,
            estimatedPortion: `${massEstimate.estimatedGrams}g (estimated)`,
            nutritionStatus: "error",
            nutrition: null,
            highlights: [],
            errorMessage:
              itemError instanceof Error ? itemError.message : "Failed to retrieve nutrition details",
          };
        }
      })
    );

    // Collect settled items safely
    const analyzedItems: AnalyzedFoodItem[] = settledResults.map((settled, index) => {
      if (settled.status === "fulfilled") {
        return settled.value;
      }
      const rawItem = recognitionResult.items[index];
      return {
        name: rawItem?.name || "Unknown Food",
        canonicalName: rawItem?.canonicalName || "Unknown",
        confidence: rawItem?.confidence || 0,
        description: rawItem?.description || "",
        estimatedPortion: rawItem?.estimatedPortion || "100g",
        nutritionStatus: "error",
        nutrition: null,
        highlights: [],
        errorMessage: settled.reason?.message || "Unexpected processing error",
      };
    });

    const responseData: FoodAnalysisResponseData = {
      items: analyzedItems,
      imageQuality: recognitionResult.imageQuality,
      message: recognitionResult.message,
      analyzedAt: new Date().toISOString(),
    };

    // Attach calibration to response if successful
    if (calibrationSummary) {
      responseData.calibration = calibrationSummary;
    }

    console.log(`[analyze-food] Preparing response: ${analyzedItems.length} items, quality=${recognitionResult.imageQuality}`);
    console.log(`[analyze-food] Response payload size: ~${JSON.stringify(responseData).length} bytes`);

    const finalResponse: AnalyzeFoodSuccessResponse = {
      success: true,
      data: responseData,
    };

    console.log(`[analyze-food] Final response structure:`, {
      success: true,
      itemCount: responseData.items.length,
      imageQuality: responseData.imageQuality,
      hasCalibration: !!responseData.calibration,
    });

    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error("[analyze-food] Fatal error in POST /api/analyze-food:", error);

    if (error && typeof error === "object" && "type" in error) {
      const errorObj = error as { type: string; message: string };
      return NextResponse.json(
        {
          success: false,
          error: {
            code: errorObj.type.toUpperCase(),
            message: errorObj.message,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "An unexpected server error occurred.",
        },
      },
      { status: 500 }
    );
  }
}
