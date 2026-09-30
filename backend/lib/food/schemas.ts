import { z } from "zod";

/**
 * Zod Schema for FoodItem
 *
 * This defines what a valid FoodItem looks like at runtime.
 * TypeScript types are compile-time only — Zod validates at runtime.
 */
export const FoodItemSchema = z.object({
  name: z.string().min(1, "Food name cannot be empty"),
  canonicalName: z.string().min(1, "Canonical name cannot be empty"),
  confidence: z.number().min(0).max(1),
  description: z.string(),
  estimatedPortion: z.string().min(1, "Estimated portion cannot be empty"),
});

/**
 * Zod Schema for FoodRecognitionResult
 */
export const FoodRecognitionResultSchema = z.object({
  items: z.array(FoodItemSchema),
  imageQuality: z.enum(["good", "poor", "unrecognizable"]),
  message: z.string().optional(),
});

/**
 * Zod Schema for validating Gemini API responses
 *
 * This is what we expect Gemini to return when we ask it to identify food.
 * We validate against this schema because we cannot trust that the AI will
 * always return perfectly formatted JSON.
 */
export const GeminiResponseSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      canonicalName: z.string(),
      confidence: z.number().min(0).max(1),
      description: z.string(),
      estimatedPortion: z.string(),
    })
  ),
  imageQuality: z.enum(["good", "poor", "unrecognizable"]),
  message: z.string().optional(),
});
