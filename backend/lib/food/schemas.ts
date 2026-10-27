import { z } from "zod";

/**
 * Geometry category enum for Zod validation.
 * Matches the FoodGeometryCategory type in types.ts.
 */
const FoodGeometryCategorySchema = z.enum([
  "discrete_unit",
  "amorphous_mound",
  "solid_slab",
  "liquid_or_bowl",
]);

/**
 * 2D bounding box normalized to 0-1000 scale.
 * Format: [ymin, xmin, ymax, xmax] (top, left, bottom, right).
 */
const Box2DSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

/**
 * Zod Schema for FoodItem
 *
 * This defines what a valid FoodItem looks like at runtime.
 * TypeScript types are compile-time only — Zod validates at runtime.
 *
 * Geometry fields (estimatedGrams, foodGeometryCategory, etc.) are optional
 * and only present when reference calibration data is available.
 */
export const FoodItemSchema = z.object({
  name: z.string().min(1, "Food name cannot be empty"),
  canonicalName: z.string().min(1, "Canonical name cannot be empty"),
  confidence: z.number().min(0).max(1),
  description: z.string(),
  estimatedPortion: z.string().min(1, "Estimated portion cannot be empty"),
  // Geometry & Calibration Fields (Optional)
  estimatedGrams: z.number().positive().optional(),
  foodGeometryCategory: FoodGeometryCategorySchema.optional(),
  sizeTier: z.string().optional(),
  heightProfile: z.string().optional(),
  itemCount: z.number().int().nonnegative().optional(),
  visualScaleCue: z.string().optional(),
  box2d: Box2DSchema.nullable().optional(),
});

/**
 * Detected reference marker in the image (if calibration was used).
 * Only present when a marker was successfully detected and validated.
 * Can be null or omitted when no marker is detected.
 */
const DetectedMarkerSchema = z.object({
  markerType: z.string().nullable().optional(), // e.g., "credit_card", "us_quarter"
  confidence: z.number().min(0).max(1).nullable().optional(),
  box2d: Box2DSchema.nullable().optional(),
}).nullable().optional();

/**
 * Zod Schema for FoodRecognitionResult
 *
 * Extended to include optional detectedMarker field for calibration context.
 */
export const FoodRecognitionResultSchema = z.object({
  items: z.array(FoodItemSchema),
  imageQuality: z.enum(["good", "poor", "unrecognizable"]),
  message: z.string().optional(),
  detectedMarker: DetectedMarkerSchema,
});

/**
 * Zod Schema for validating Gemini API responses
 *
 * This is what we expect Gemini to return when we ask it to identify food.
 * We validate against this schema because we cannot trust that the AI will
 * always return perfectly formatted JSON.
 *
 * Extended to include optional geometry fields and detectedMarker.
 * The parser is resilient: missing fields are allowed and will be undefined.
 */
export const GeminiResponseSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      canonicalName: z.string(),
      confidence: z.number().min(0).max(1),
      description: z.string(),
      estimatedPortion: z.string(),
      // Geometry & Calibration Fields (Optional, for resilience)
      estimatedGrams: z.number().positive().optional(),
      foodGeometryCategory: FoodGeometryCategorySchema.optional(),
      sizeTier: z.string().optional(),
      heightProfile: z.string().optional(),
      itemCount: z.number().int().nonnegative().optional(),
      visualScaleCue: z.string().optional(),
      box2d: Box2DSchema.nullable().optional(),
    })
  ),
  imageQuality: z.enum(["good", "poor", "unrecognizable"]),
  message: z.string().optional(),
  detectedMarker: DetectedMarkerSchema,
});
