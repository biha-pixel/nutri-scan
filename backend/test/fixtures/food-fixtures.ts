/**
 * Test Fixtures for Food Recognition & Nutrition Testing
 *
 * This fixture set describes the 8 critical scenarios across the NutriScan pipeline:
 * 1. Single Food — High confidence recognition with matching USDA nutrition data
 * 2. Multiple Foods — Multi-item meal scan with independent items
 * 3. No Food — Non-food image (e.g. laptop, room) resulting in empty recognition
 * 4. Unknown Food — Unidentifiable or low quality item
 * 5. Ambiguous Food — Borderline confidence with multiple candidate matches
 * 6. Nutrition API Failure — AI succeeds but USDA service returns error/500/rate limit
 * 7. AI Failure — Vision provider throws an error (e.g., quota, network, timeout)
 * 8. Malformed Upload — Invalid MIME type, oversized file, or empty image buffer
 */

import type { FoodRecognitionResult } from "@/lib/food/types";
import type { NutritionData } from "@/lib/nutrition/types";

export interface FixtureScenario<TInput, TExpected> {
  description: string;
  input: TInput;
  expected: TExpected;
}

// ─── 1. Single Food Fixture ──────────────────────────────────────────
export const singleFoodFixture = {
  description: "Recognizes a single high-confidence food item (banana)",
  visionResult: {
    items: [
      {
        name: "banana",
        canonicalName: "banana",
        confidence: 0.95,
        description: "Fresh yellow ripe banana",
        estimatedPortion: "1 medium (118g)",
      },
    ],
    imageQuality: "good",
  } satisfies FoodRecognitionResult,
  nutritionData: {
    foodName: "Bananas, raw",
    source: "usda_fdc",
    sourceId: "173944",
    servingSize: 118,
    servingUnit: "g",
    calories: 105,
    macronutrients: {
      protein: 1.29,
      totalFat: 0.39,
      saturatedFat: 0.13,
      carbohydrates: 26.95,
      fiber: 3.07,
      sugar: 14.43,
    },
    micronutrients: {
      sodium: 1,
      cholesterol: 0,
      potassium: 422,
      vitaminA: null,
      vitaminC: 10.27,
      calcium: 5.9,
      iron: 0.31,
    },
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/173944/nutrients",
    matchConfidence: "exact",
  } satisfies NutritionData,
};

// ─── 2. Multiple Foods Fixture ───────────────────────────────────────
export const multipleFoodsFixture = {
  description: "Recognizes multiple distinct food items in a meal plate",
  visionResult: {
    items: [
      {
        name: "Grilled Chicken Breast",
        canonicalName: "chicken breast",
        confidence: 0.92,
        description: "Cooked lean chicken breast",
        estimatedPortion: "150g",
      },
      {
        name: "Steamed Broccoli",
        canonicalName: "broccoli",
        confidence: 0.88,
        description: "Steamed green broccoli florets",
        estimatedPortion: "1 cup (85g)",
      },
      {
        name: "Brown Rice",
        canonicalName: "brown rice",
        confidence: 0.85,
        description: "Cooked whole grain brown rice",
        estimatedPortion: "1 cup (195g)",
      },
    ],
    imageQuality: "good",
  } satisfies FoodRecognitionResult,
  nutritionItems: [
    {
      foodName: "Chicken breast, grilled",
      source: "usda_fdc",
      sourceId: "171077",
      servingSize: 150,
      servingUnit: "g",
      calories: 248,
      macronutrients: {
        protein: 46.5,
        totalFat: 5.4,
        saturatedFat: 1.5,
        carbohydrates: 0,
        fiber: 0,
        sugar: 0,
      },
      micronutrients: {
        sodium: 111,
        cholesterol: 128,
        potassium: 384,
        vitaminA: null,
        vitaminC: null,
        calcium: 22,
        iron: 1.5,
      },
      sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/171077/nutrients",
      matchConfidence: "exact",
    },
    {
      foodName: "Broccoli, steamed",
      source: "usda_fdc",
      sourceId: "170379",
      servingSize: 85,
      servingUnit: "g",
      calories: 30,
      macronutrients: {
        protein: 2.0,
        totalFat: 0.35,
        saturatedFat: 0.05,
        carbohydrates: 6.0,
        fiber: 2.3,
        sugar: 1.2,
      },
      micronutrients: {
        sodium: 35,
        cholesterol: 0,
        potassium: 240,
        vitaminA: null,
        vitaminC: 54.0,
        calcium: 38,
        iron: 0.6,
      },
      sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/170379/nutrients",
      matchConfidence: "exact",
    },
  ] satisfies NutritionData[],
};

// ─── 3. No Food Fixture ──────────────────────────────────────────────
export const noFoodFixture = {
  description: "Non-food image uploaded (e.g. laptop, room, furniture)",
  visionResult: {
    items: [],
    imageQuality: "unrecognizable",
    message: "No food items detected in the image.",
  } satisfies FoodRecognitionResult,
};

// ─── 4. Unknown Food Fixture ─────────────────────────────────────────
export const unknownFoodFixture = {
  description: "Image contains an item that cannot be reliably recognized",
  visionResult: {
    items: [
      {
        name: "Unknown substance",
        canonicalName: "unknown",
        confidence: 0.32,
        description: "Blurry or unidentifiable mixture",
        estimatedPortion: "unspecified",
      },
    ],
    imageQuality: "poor",
    message: "Image quality is poor or food is unrecognizable.",
  } satisfies FoodRecognitionResult,
};

// ─── 5. Ambiguous Food Fixture ───────────────────────────────────────
export const ambiguousFoodFixture = {
  description: "Borderline confidence food item with multiple possible USDA candidates",
  visionResult: {
    items: [
      {
        name: "Soup",
        canonicalName: "soup",
        confidence: 0.55,
        description: "Liquid soup or broth with mixed vegetables",
        estimatedPortion: "1 bowl",
      },
    ],
    imageQuality: "good",
  } satisfies FoodRecognitionResult,
  candidateMatches: [
    {
      sourceId: "171589",
      foodName: "Soup, vegetable broth",
      score: 0.58,
    },
    {
      sourceId: "171592",
      foodName: "Soup, chicken noodle, canned",
      score: 0.52,
    },
    {
      sourceId: "171595",
      foodName: "Soup, tomato, canned",
      score: 0.49,
    },
  ],
};

// ─── 6. Nutrition API Failure Fixture ────────────────────────────────
export const nutritionApiFailureFixture = {
  description: "Vision succeeds, but external USDA API fails with 500 or 429",
  visionResult: {
    items: [
      {
        name: "Apple",
        canonicalName: "apple",
        confidence: 0.95,
        description: "Red delicious apple",
        estimatedPortion: "1 medium",
      },
    ],
    imageQuality: "good",
  } satisfies FoodRecognitionResult,
  apiError: {
    type: "provider_error",
    message: "USDA FoodData Central API is unavailable (HTTP 503)",
    statusCode: 503,
  },
};

// ─── 7. AI Vision Provider Failure Fixture ───────────────────────────
export const aiFailureFixture = {
  description: "AI vision provider fails due to rate limits, timeout, or network crash",
  visionError: {
    type: "api_error" as const,
    message: "Gemini Vision API quota exceeded. Please try again later.",
  },
};

// ─── 8. Malformed Upload Fixture ─────────────────────────────────────
export const malformedUploadFixtures = {
  emptyBuffer: {
    description: "0-byte image payload",
    buffer: Buffer.alloc(0),
    mimeType: "image/jpeg",
    expectedError: "Image buffer is empty",
  },
  invalidMimeType: {
    description: "Unsupported file type (e.g. PDF or plain text)",
    buffer: Buffer.from("Not an image at all"),
    mimeType: "application/pdf",
    expectedError: "Unsupported image type: application/pdf",
  },
  oversizedBuffer: {
    description: "Payload exceeds 20MB limit",
    buffer: Buffer.alloc(21 * 1024 * 1024), // 21MB
    mimeType: "image/png",
    expectedError: "Image too large",
  },
};
