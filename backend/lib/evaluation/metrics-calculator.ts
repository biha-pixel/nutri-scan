/**
 * Metrics Calculator Utility
 *
 * Core mathematical functions for computing accuracy metrics:
 * - MAE (Mean Absolute Error) in grams
 * - MAPE (Mean Absolute Percentage Error) in %
 * - WMAPE (Weighted Mean Absolute Percentage Error) in %
 * - RMSE (Root Mean Square Error) in grams
 */

import type { WeighedFoodSample } from './types';

/**
 * Calculate Mean Absolute Error (MAE) in grams
 * Average of absolute differences between predicted and actual weights
 */
export function calculateMAE(samples: WeighedFoodSample[]): number {
  if (samples.length === 0) return 0;
  const errors = samples.map(s => Math.abs(s.predictedGrams - s.actualGrams));
  return errors.reduce((a, b) => a + b, 0) / samples.length;
}

/**
 * Calculate Mean Absolute Percentage Error (MAPE) in %
 * Average of absolute percentage errors
 * Handles edge case where actual grams could be 0
 */
export function calculateMAPE(samples: WeighedFoodSample[]): number {
  if (samples.length === 0) return 0;
  const percentErrors = samples
    .filter(s => s.actualGrams > 0) // Exclude zero actual weights
    .map(s => (Math.abs(s.predictedGrams - s.actualGrams) / s.actualGrams) * 100);
  if (percentErrors.length === 0) return 0;
  return percentErrors.reduce((a, b) => a + b, 0) / percentErrors.length;
}

/**
 * Calculate Weighted Mean Absolute Percentage Error (WMAPE) in %
 * Accounts for the magnitude of actual values
 * Better for comparing across different portion sizes
 */
export function calculateWMAPE(samples: WeighedFoodSample[]): number {
  if (samples.length === 0) return 0;
  const numerator = samples.reduce(
    (sum, s) => sum + Math.abs(s.predictedGrams - s.actualGrams),
    0
  );
  const denominator = samples.reduce((sum, s) => sum + s.actualGrams, 0);
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

/**
 * Calculate Root Mean Square Error (RMSE) in grams
 * Penalizes larger errors more heavily than MAE
 */
export function calculateRMSE(samples: WeighedFoodSample[]): number {
  if (samples.length === 0) return 0;
  const squaredErrors = samples.map(s =>
    Math.pow(s.predictedGrams - s.actualGrams, 2)
  );
  const mse = squaredErrors.reduce((a, b) => a + b, 0) / samples.length;
  return Math.sqrt(mse);
}

/**
 * Round a metric value to 1 decimal place for display
 */
export function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}
