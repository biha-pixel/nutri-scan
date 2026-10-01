import { NextRequest, NextResponse } from "next/server";
import {
  NutritionLookupService,
  USDANutritionProvider,
  type NutritionLookupResult,
} from "@/lib/nutrition";
import { z } from "zod";

/**
 * POST /api/nutrition/details
 *
 * Get full nutrition data for a specific food by its source ID.
 *
 * This endpoint is used AFTER the user has selected a food from
 * a list of ambiguous candidates returned by /api/nutrition/lookup.
 *
 * Request body (JSON):
 *   { "sourceId": "171077" }
 *
 * The response format is the same as /api/nutrition/lookup.
 */

// ─── Input Validation ─────────────────────────────────────────────

const DetailsRequestSchema = z.object({
  sourceId: z
    .string()
    .min(1, "Source ID cannot be empty.")
    .max(50, "Source ID is too long (max 50 characters)."),
});

// ─── Provider Setup ───────────────────────────────────────────────

function createNutritionService(): NutritionLookupService | null {
  const apiKey = process.env.USDA_API_KEY;

  if (!apiKey) {
    console.warn(
      "[/api/nutrition/details] USDA_API_KEY not set — nutrition lookup is unavailable."
    );
    return null;
  }

  const provider = new USDANutritionProvider(apiKey);
  return new NutritionLookupService(provider);
}

const nutritionService = createNutritionService();

// ─── Route Handler ────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<NutritionLookupResult | { success: false; error: { code: string; message: string } }>> {
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

    const validation = DetailsRequestSchema.safeParse(body);
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

    const result = await nutritionService.getNutritionById(
      validation.data.sourceId
    );

    if (result.success) {
      return NextResponse.json(result);
    }

    const statusCode =
      result.error.type === "not_found"
        ? 404
        : result.error.type === "timeout"
          ? 408
          : result.error.type === "api_error"
            ? 502
            : 422;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error("Unexpected error in /api/nutrition/details:", error);
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
