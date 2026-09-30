import { NextRequest, NextResponse } from "next/server";
import { FoodAnalysisService } from "@/lib/food/analysis-service";
import { GeminiVisionProvider } from "@/lib/food/gemini-provider";
import { MockVisionProvider } from "./mock-vision-provider";
import { ImageUploadSchema } from "@/lib/validation/schemas";
import type { VisionProvider } from "@/lib/food/vision-provider";

/**
 * POST /api/scan
 *
 * This is the ROUTE HANDLER — the entry point for the food scan API.
 *
 * Responsibilities:
 * 1. Parse the incoming multipart/form-data request
 * 2. Validate the image using Zod
 * 3. Call the food analysis service
 * 4. Return the structured response
 *
 * What this does NOT do:
 * - Does NOT directly call Gemini
 * - Does NOT contain business logic
 * - Does NOT validate food recognition results (that's the service's job)
 *
 * This separation is called "separation of concerns" — each layer has one job.
 */

/**
 * Type for successful scan response
 */
interface ScanSuccessResponse {
  success: true;
  data: {
    items: Array<{
      name: string;
      canonicalName: string;
      confidence: number;
      description: string;
      estimatedPortion: string;
    }>;
    imageQuality: "good" | "poor" | "unrecognizable";
    message?: string;
  };
}

/**
 * Type for error response
 */
interface ScanErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type ScanResponse = ScanSuccessResponse | ScanErrorResponse;

// Create the food analysis service with the appropriate provider.
//
// We need three required environment variables for the real provider:
//   OMNIROUTE_API_KEY  — the API key for OmniRoute
//   OMNIROUTE_BASE_URL — the OmniRoute server URL (e.g., "http://localhost:20128")
//   OMNIROUTE_MODEL    — the model identifier (e.g., "gemini")
//
// Optional variables:
//   OMNIROUTE_MAX_RETRIES — how many times to retry on bad/non-JSON response (default: 5)
//   OMNIROUTE_RETRY_DELAY — base delay in ms between retries (default: 1000)
//
// If all three required vars are set, we use the real Gemini provider via OmniRoute.
// Otherwise, we fall back to the mock provider for development.
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
    "[/api/scan] OmniRoute env vars not fully set — using MockVisionProvider. " +
    "Set OMNIROUTE_API_KEY, OMNIROUTE_BASE_URL, and OMNIROUTE_MODEL in .env.local " +
    "to use real food recognition."
  );
  return new MockVisionProvider();
}

const foodService = new FoodAnalysisService(createVisionProvider());

export async function POST(request: NextRequest): Promise<NextResponse<ScanResponse>> {
  try {
    // Step 1: Parse the multipart form data
    const formData = await request.formData();
    const imageFile = formData.get("image");

    // Step 2: Validate the request
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

    // Check if it's actually a File
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

    // Validate with Zod schema
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

    // Step 3: Convert the file to a Buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const mimeType = imageFile.type || "image/jpeg";

    // Step 4: Call the food analysis service
    const result = await foodService.analyzeFood(imageBuffer, mimeType);

    // Step 5: Return the success response
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle known error types
    if (error && typeof error === "object" && "type" in error) {
      const errorObj = error as { type: string; message: string };
      return NextResponse.json(
        {
          success: false,
          error: {
            code: errorObj.type.toUpperCase().replace(/_/g, "_"),
            message: errorObj.message,
          },
        },
        { status: 400 }
      );
    }

    // Handle unexpected errors
    console.error("Unexpected error in /api/scan:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}