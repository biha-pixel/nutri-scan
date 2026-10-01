/**
 * Database Validation Schemas
 *
 * Runtime validation for database inputs and query results using Zod.
 * Ensures data integrity before hitting the database and guarantees
 * type safety when parsing rows returned from PostgreSQL.
 */

import { z } from "zod";

export const MacronutrientsSchema = z.object({
  protein: z.number().nullable().default(null),
  totalFat: z.number().nullable().default(null),
  saturatedFat: z.number().nullable().default(null),
  carbohydrates: z.number().nullable().default(null),
  fiber: z.number().nullable().default(null),
  sugar: z.number().nullable().default(null),
});

export const MicronutrientsSchema = z.object({
  sodium: z.number().nullable().default(null),
  cholesterol: z.number().nullable().default(null),
  potassium: z.number().nullable().default(null),
  vitaminA: z.number().nullable().default(null),
  vitaminC: z.number().nullable().default(null),
  calcium: z.number().nullable().default(null),
  iron: z.number().nullable().default(null),
});

export const HighlightSchema = z.object({
  text: z.string(),
  description: z.string(),
  nutrient: z.string(),
  level: z.enum(["high", "good", "low", "info"]),
  category: z.enum(["macronutrient", "micronutrient", "mineral", "energy_balance"]),
  referenceBasis: z.string(),
  priority: z.number(),
});

export const NutrientsPayloadSchema = z
  .object({
    calories: z.number().nullable().optional().default(null),
    macronutrients: MacronutrientsSchema.optional().default({
      protein: null,
      totalFat: null,
      saturatedFat: null,
      carbohydrates: null,
      fiber: null,
      sugar: null,
    }),
    micronutrients: MicronutrientsSchema.optional().default({
      sodium: null,
      cholesterol: null,
      potassium: null,
      vitaminA: null,
      vitaminC: null,
      calcium: null,
      iron: null,
    }),
  })
  .default({
    calories: null,
    macronutrients: {
      protein: null,
      totalFat: null,
      saturatedFat: null,
      carbohydrates: null,
      fiber: null,
      sugar: null,
    },
    micronutrients: {
      sodium: null,
      cholesterol: null,
      potassium: null,
      vitaminA: null,
      vitaminC: null,
      calcium: null,
      iron: null,
    },
  });

export const CreateScanItemInputSchema = z.object({
  foodName: z.string().min(1, "Food name is required"),
  confidence: z.number().min(0).max(1),
  nutritionSource: z.string().default("usda_fdc"),
  nutritionId: z.string().nullable().optional().default(null),
  servingBasis: z.string().default("100g"),
  nutrients: NutrientsPayloadSchema,
  highlights: z.array(HighlightSchema).default([]),
});

export const CreateScanInputSchema = z.object({
  userId: z.string().uuid("Invalid user UUID").nullable().optional().default(null),
  imageUrl: z.string().nullable().optional().default(null),
  items: z.array(CreateScanItemInputSchema).min(1, "At least one item is required to save a scan"),
});

export const ScanHistoryQuerySchema = z.object({
  userId: z.string().uuid("Invalid user UUID format"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
