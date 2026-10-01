import { NextRequest, NextResponse } from "next/server";
import { FoodAnalysisService } from "@/lib/food/analysis-service";
import { GeminiVisionProvider } from "@/lib/food/gemini-provider";
import { MockVisionProvider } from "../scan/mock-vision-provider";
import { USDANutritionProvider } from "@/lib/nutrition/usda-provider";
import { NutritionLookupService } from "@/lib/nutrition/nutrition-service";
import { NutritionHighlightService } from "@/lib/highlights/highlights-service";
import { ImageUploadSchema } from "@/lib/validation/schemas";
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

export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalyzeFoodApiResponse>> {
  try {
    // 1. Parse Multipart Form Data
    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (!imageFile) {
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

    // 3. Convert image to Buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const mimeType = imageFile.type || "image/jpeg";

    // 4. AI Food Recognition via Vision Provider
    console.log("[analyze-food] Analyzing image with VisionProvider...");
    const recognitionResult = await foodAnalysisService.analyzeFood(imageBuffer, mimeType);

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

    // 5. Lookup Nutrition & Highlights for each item in parallel with Promise.allSettled
    console.log(
      `[analyze-food] Identified ${recognitionResult.items.length} item(s). Looking up nutrition...`
    );

    const settledResults = await Promise.allSettled(
      recognitionResult.items.map(async (item): Promise<AnalyzedFoodItem> => {
        const query = item.canonicalName || item.name;
        try {
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
            // Generate deterministic educational highlights from the nutrition data
            const highlights = highlightService.generateHighlights(lookupResult.data);
            return {
              name: item.name,
              canonicalName: item.canonicalName,
              confidence: item.confidence,
              description: item.description,
              estimatedPortion: item.estimatedPortion,
              nutritionStatus: "found",
              nutrition: lookupResult.data,
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
                estimatedPortion: item.estimatedPortion,
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
              estimatedPortion: item.estimatedPortion,
              nutritionStatus: "not_found",
              nutrition: null,
              highlights: [],
              errorMessage: err.message,
            };
          }
        } catch (itemError) {
          console.error(`[analyze-food] Error resolving nutrition for ${query}:`, itemError);
          return {
            name: item.name,
            canonicalName: item.canonicalName,
            confidence: item.confidence,
            description: item.description,
            estimatedPortion: item.estimatedPortion,
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

    return NextResponse.json({
      success: true,
      data: {
        items: analyzedItems,
        imageQuality: recognitionResult.imageQuality,
        message: recognitionResult.message,
        analyzedAt: new Date().toISOString(),
      },
    });
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
