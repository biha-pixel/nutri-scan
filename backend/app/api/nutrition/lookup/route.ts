import { NextRequest, NextResponse } from "next/server";
import {
  NutritionLookupService,
  USDANutritionProvider,
  type NutritionLookupResult,
} from "@/lib/nutrition";
import { z } from "zod";

/**
 * POST /api/nutrition/lookup
 *
 * Look up nutrition data for a food by name.
 *
 * Request body (JSON):
 *   { "foodName": "Bananas, raw" }
 *
 * Success response:
 *   { "success": true, "data": { ...NutritionData } }
 *
 * Error response:
 *   { "success": false, "error": { "code": "...", "message": "...", ... } }
 *
 * This route follows the SAME PATTERNS as /api/scan:
 *   1. Parse and validate input with Zod
 *   2. Delegate to the service layer
 *   3. Return a discriminated union response
 */

// ─── Input Validation ─────────────────────────────────────────────

/**
 * Zod schema for the request body.
 * We validate server-side because CLAUDE.md says:
 * "Validate all input on the server with Zod before processing it."
 */
const LookupRequestSchema = z.object({
  foodName: z
    .string()
    .min(1, "Food name cannot be empty.")
    .max(200, "Food name is too long (max 200 characters)."),
});

// ─── Provider Setup ───────────────────────────────────────────────

/**
 * Create the nutrition provider from environment variables.
 *
 * The USDA API key is a SERVER-SIDE SECRET — it lives in .env.local
 * and is never sent to the mobile app. This is the same pattern as
 * createVisionProvider() in /api/scan/route.ts.
 */
function createNutritionService(): NutritionLookupService | null {
  const apiKey = process.env.USDA_API_KEY;

  if (!apiKey) {
    console.warn(
      "[/api/nutrition/lookup] USDA_API_KEY not set — nutrition lookup is unavailable. " +
        "Get a free key at https://fdc.nal.usda.gov/api-key-signup.html and add it to .env.local."
    );
    return null;
  }

  const provider = new USDANutritionProvider(apiKey);
  return new NutritionLookupService(provider);
}

// Create the service once at module load (same as /api/scan)
const nutritionService = createNutritionService();

// ─── Route Handler ────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<NutritionLookupResult | { success: false; error: { code: string; message: string } }>> {
  // Guard: is the service available?
  if (!nutritionService) {
    return NextResponse.json(
      {
        success: false as const,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message:
            "Nutrition lookup is not configured. The USDA API key is missing.",
        },
      },
      { status: 503 }
    );
  }

  try {
    // Step 1: Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON.",
          },
        },
        { status: 400 }
      );
    }

    // Step 2: Validate with Zod
    const validation = LookupRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.error.errors.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    // Step 3: Delegate to the service
    const result = await nutritionService.lookupNutrition(
      validation.data.foodName
    );

    // Step 4: Return the result
    // The service returns { success: true, data } or { success: false, error }
    if (result.success) {
      return NextResponse.json(result);
    }

    // Map error types to appropriate HTTP status codes
    const statusCode = errorTypeToHttpStatus(result.error.type);
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error("Unexpected error in /api/nutrition/lookup:", error);
    return NextResponse.json(
      {
        success: false as const,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Map NutritionLookupError types to HTTP status codes.
 *
 * This keeps HTTP concerns (status codes) in the route handler,
 * not in the service or provider layers.
 */
function errorTypeToHttpStatus(
  errorType: string
): 400 | 404 | 408 | 422 | 429 | 500 | 502 {
  switch (errorType) {
    case "not_found":
      return 404;
    case "timeout":
      return 408;
    case "validation_error":
      return 422;
    case "ambiguous_match":
      return 422; // Unprocessable: we need the user to clarify
    case "api_error":
      return 502; // Bad Gateway: our upstream (USDA) failed
    default:
      return 500;
  }
}
