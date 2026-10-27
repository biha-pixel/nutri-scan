/**
 * Zod Validation Schemas for Accuracy Evaluation Module
 */

import { z } from 'zod';

export const WeighedFoodSampleSchema = z.object({
  predictedGrams: z.number().positive('Predicted grams must be positive'),
  actualGrams: z.number().positive('Actual grams must be positive'),
  foodGeometryCategory: z.enum(
    ['discrete_unit', 'amorphous_mound', 'solid_slab', 'liquid_or_bowl'],
    { errorMap: () => ({ message: 'Invalid food geometry category' }) }
  ),
  estimationMethod: z.string().min(1, 'Estimation method is required'),
  confidence: z.enum(['high', 'medium', 'low'], {
    errorMap: () => ({ message: 'Confidence must be high, medium, or low' }),
  }),
  uncertaintyGrams: z.number().optional(),
});

type AccuracyMetricsType = {
  mae: number;
  mape: number;
  wmape: number;
  rmse: number;
  count: number;
  samplesByGeometry?: Record<string, AccuracyMetricsType>;
  samplesByMethod?: Record<string, AccuracyMetricsType>;
};

export const AccuracyMetricsSchema: z.ZodType<AccuracyMetricsType> = z.lazy(() => z.object({
  mae: z.number(),
  mape: z.number(),
  wmape: z.number(),
  rmse: z.number(),
  count: z.number().int(),
  samplesByGeometry: z.record(AccuracyMetricsSchema).optional(),
  samplesByMethod: z.record(AccuracyMetricsSchema).optional(),
}) as z.ZodType<AccuracyMetricsType>);

export const ComparisonResultSchema = z.union([
  z.object({
    success: z.literal(true),
    metrics: AccuracyMetricsSchema,
  }),
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
]);

export type WeighedFoodSample = z.infer<typeof WeighedFoodSampleSchema>;
export type AccuracyMetrics = AccuracyMetricsType;
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;
