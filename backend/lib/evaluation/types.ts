/**
 * Accuracy Evaluation Types
 *
 * Interfaces for weighed food samples and accuracy metrics computation
 */

export interface WeighedFoodSample {
  predictedGrams: number;
  actualGrams: number;
  foodGeometryCategory: 'discrete_unit' | 'amorphous_mound' | 'solid_slab' | 'liquid_or_bowl';
  estimationMethod: string; // e.g., "discrete_unit_calibrated", "volume_calibrated", "fallback_standard_portion"
  confidence: 'high' | 'medium' | 'low';
  uncertaintyGrams?: number;
}

export interface AccuracyMetrics {
  mae: number; // Mean Absolute Error (grams)
  mape: number; // Mean Absolute Percentage Error (%)
  wmape: number; // Weighted Mean Absolute Percentage Error (%)
  rmse: number; // Root Mean Square Error (grams)
  count: number; // Sample count
  samplesByGeometry: { [category: string]: AccuracyMetrics };
  samplesByMethod: { [method: string]: AccuracyMetrics };
}

export interface ComparisonResult {
  success: boolean;
  metrics?: AccuracyMetrics;
  error?: { code: string; message: string };
}
