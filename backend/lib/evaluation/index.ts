/**
 * Accuracy Evaluation Module — Public API
 *
 * Exports:
 * - Types: WeighedFoodSample, AccuracyMetrics, ComparisonResult
 * - Service: AccuracyEvaluator
 * - Schemas: Zod validation for runtime type checking
 * - Utilities: Metric calculation functions
 */

export type { WeighedFoodSample, AccuracyMetrics, ComparisonResult } from './types';
export { AccuracyEvaluator } from './accuracy-evaluator';
export {
  WeighedFoodSampleSchema,
  AccuracyMetricsSchema,
  ComparisonResultSchema,
} from './schemas';
export * as MetricsCalculator from './metrics-calculator';
