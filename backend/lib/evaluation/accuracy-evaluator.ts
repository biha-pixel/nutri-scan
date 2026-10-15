/**
 * Accuracy Evaluator Service
 *
 * Computes accuracy metrics for weighed food samples across geometry categories
 * and estimation methods. Supports MAE, MAPE, WMAPE, and RMSE calculations with
 * per-category and per-method breakdowns.
 */

import type { WeighedFoodSample, AccuracyMetrics, ComparisonResult } from './types';
import {
  calculateMAE,
  calculateMAPE,
  calculateWMAPE,
  calculateRMSE,
  roundMetric,
} from './metrics-calculator';

export class AccuracyEvaluator {
  /**
   * Evaluate accuracy metrics for a set of weighed food samples
   * Returns overall metrics plus breakdowns by geometry category and estimation method
   */
  evaluate(samples: WeighedFoodSample[]): ComparisonResult {
    // Validate input
    if (!samples || samples.length === 0) {
      return {
        success: false,
        error: {
          code: 'EMPTY_SAMPLES',
          message: 'No samples provided for evaluation',
        },
      };
    }

    try {
      // Calculate overall metrics
      const mae = calculateMAE(samples);
      const mape = calculateMAPE(samples);
      const wmape = calculateWMAPE(samples);
      const rmse = calculateRMSE(samples);

      // Group samples by geometry category
      const samplesByGeometry: { [key: string]: WeighedFoodSample[] } = {};
      samples.forEach(s => {
        if (!samplesByGeometry[s.foodGeometryCategory]) {
          samplesByGeometry[s.foodGeometryCategory] = [];
        }
        samplesByGeometry[s.foodGeometryCategory].push(s);
      });

      // Calculate metrics per geometry category
      const geometryMetrics: { [key: string]: AccuracyMetrics } = {};
      Object.entries(samplesByGeometry).forEach(([category, categorySamples]) => {
        geometryMetrics[category] = {
          mae: roundMetric(calculateMAE(categorySamples)),
          mape: roundMetric(calculateMAPE(categorySamples)),
          wmape: roundMetric(calculateWMAPE(categorySamples)),
          rmse: roundMetric(calculateRMSE(categorySamples)),
          count: categorySamples.length,
          samplesByGeometry: {},
          samplesByMethod: {},
        };
      });

      // Group samples by estimation method
      const samplesByMethod: { [key: string]: WeighedFoodSample[] } = {};
      samples.forEach(s => {
        if (!samplesByMethod[s.estimationMethod]) {
          samplesByMethod[s.estimationMethod] = [];
        }
        samplesByMethod[s.estimationMethod].push(s);
      });

      // Calculate metrics per estimation method
      const methodMetrics: { [key: string]: AccuracyMetrics } = {};
      Object.entries(samplesByMethod).forEach(([method, methodSamples]) => {
        methodMetrics[method] = {
          mae: roundMetric(calculateMAE(methodSamples)),
          mape: roundMetric(calculateMAPE(methodSamples)),
          wmape: roundMetric(calculateWMAPE(methodSamples)),
          rmse: roundMetric(calculateRMSE(methodSamples)),
          count: methodSamples.length,
          samplesByGeometry: {},
          samplesByMethod: {},
        };
      });

      // Return overall metrics with breakdowns
      return {
        success: true,
        metrics: {
          mae: roundMetric(mae),
          mape: roundMetric(mape),
          wmape: roundMetric(wmape),
          rmse: roundMetric(rmse),
          count: samples.length,
          samplesByGeometry: geometryMetrics,
          samplesByMethod: methodMetrics,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EVALUATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error during evaluation',
        },
      };
    }
  }

  /**
   * Get accuracy metrics for a specific geometry category
   */
  evaluateByGeometry(
    samples: WeighedFoodSample[],
    category: string
  ): ComparisonResult {
    const filtered = samples.filter(s => s.foodGeometryCategory === category);
    if (filtered.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_SAMPLES_FOR_CATEGORY',
          message: `No samples found for geometry category: ${category}`,
        },
      };
    }
    return this.evaluate(filtered);
  }

  /**
   * Get accuracy metrics for a specific estimation method
   */
  evaluateByMethod(
    samples: WeighedFoodSample[],
    method: string
  ): ComparisonResult {
    const filtered = samples.filter(s => s.estimationMethod === method);
    if (filtered.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_SAMPLES_FOR_METHOD',
          message: `No samples found for estimation method: ${method}`,
        },
      };
    }
    return this.evaluate(filtered);
  }

  /**
   * Compare accuracy between two estimation methods
   */
  compareEstimationMethods(
    samples: WeighedFoodSample[],
    method1: string,
    method2: string
  ): {
    method1: ComparisonResult;
    method2: ComparisonResult;
    better: string | null;
  } {
    const result1 = this.evaluateByMethod(samples, method1);
    const result2 = this.evaluateByMethod(samples, method2);

    let better: string | null = null;
    if (result1.success && result2.success) {
      // Method with lower WMAPE is better (more accurate across different portion sizes)
      better =
        (result1.metrics?.wmape ?? Infinity) <
        (result2.metrics?.wmape ?? Infinity)
          ? method1
          : method2;
    }

    return { method1: result1, method2: result2, better };
  }
}
