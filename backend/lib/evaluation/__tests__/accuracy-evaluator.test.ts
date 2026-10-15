/**
 * Accuracy Evaluator Tests
 *
 * Comprehensive test suite for the AccuracyEvaluator service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AccuracyEvaluator } from '../accuracy-evaluator';
import {
  calibratedDiscreteUnitSamples,
  calibratedVolumeSamples,
  visualEstimateSamples,
  liquidBowlSamples,
  allSamples,
  singleSample,
  perfectPredictions,
  highVariancePredictions,
} from './fixtures';

describe('AccuracyEvaluator', () => {
  let evaluator: AccuracyEvaluator;

  beforeEach(() => {
    evaluator = new AccuracyEvaluator();
  });

  describe('evaluate() — overall metrics', () => {
    it('should compute MAE for calibrated discrete unit samples', () => {
      const result = evaluator.evaluate(calibratedDiscreteUnitSamples);
      expect(result.success).toBe(true);
      expect(result.metrics?.mae).toBeLessThan(3); // Very accurate
      expect(result.metrics?.count).toBe(3);
    });

    it('should compute MAPE for mixed samples', () => {
      const result = evaluator.evaluate(allSamples);
      expect(result.success).toBe(true);
      expect(result.metrics?.mape).toBeGreaterThan(0);
      expect(result.metrics?.count).toBe(allSamples.length);
    });

    it('should compute WMAPE correctly', () => {
      const result = evaluator.evaluate(allSamples);
      expect(result.success).toBe(true);
      expect(result.metrics?.wmape).toBeGreaterThan(0);
    });

    it('should compute RMSE for variance analysis', () => {
      const result = evaluator.evaluate(calibratedVolumeSamples);
      expect(result.success).toBe(true);
      expect(result.metrics?.rmse).toBeLessThan(30);
    });

    it('should handle perfect predictions (MAE = 0)', () => {
      const result = evaluator.evaluate(perfectPredictions);
      expect(result.success).toBe(true);
      expect(result.metrics?.mae).toBe(0);
      expect(result.metrics?.mape).toBe(0);
      expect(result.metrics?.wmape).toBe(0);
    });

    it('should handle high variance predictions', () => {
      const result = evaluator.evaluate(highVariancePredictions);
      expect(result.success).toBe(true);
      expect(result.metrics?.mae).toBeGreaterThan(50);
    });
  });

  describe('evaluate() — per-geometry breakdown', () => {
    it('should break down metrics by food geometry category', () => {
      const result = evaluator.evaluate(allSamples);
      expect(result.success).toBe(true);
      expect(result.metrics?.samplesByGeometry).toBeDefined();
      expect(Object.keys(result.metrics?.samplesByGeometry || {})).toContain('discrete_unit');
      expect(Object.keys(result.metrics?.samplesByGeometry || {})).toContain('amorphous_mound');
      expect(Object.keys(result.metrics?.samplesByGeometry || {})).toContain('solid_slab');
      expect(Object.keys(result.metrics?.samplesByGeometry || {})).toContain('liquid_or_bowl');
    });

    it('should compute correct sample counts per geometry', () => {
      const result = evaluator.evaluate(allSamples);
      expect(result.success).toBe(true);
      expect(result.metrics?.samplesByGeometry['discrete_unit']?.count).toBe(3);
      expect(result.metrics?.samplesByGeometry['amorphous_mound']?.count).toBe(3);
      expect(result.metrics?.samplesByGeometry['solid_slab']?.count).toBe(3);
      expect(result.metrics?.samplesByGeometry['liquid_or_bowl']?.count).toBe(3);
    });
  });

  describe('evaluate() — per-method breakdown', () => {
    it('should break down metrics by estimation method', () => {
      const result = evaluator.evaluate(allSamples);
      expect(result.success).toBe(true);
      expect(result.metrics?.samplesByMethod).toBeDefined();
      expect(Object.keys(result.metrics?.samplesByMethod || {})).toContain('discrete_unit_calibrated');
      expect(Object.keys(result.metrics?.samplesByMethod || {})).toContain('volume_calibrated');
      expect(Object.keys(result.metrics?.samplesByMethod || {})).toContain('visual_estimate');
    });

    it('should show calibrated methods have better accuracy than visual', () => {
      const result = evaluator.evaluate(allSamples);
      expect(result.success).toBe(true);
      const calibratedMape = result.metrics?.samplesByMethod['discrete_unit_calibrated']?.mape || Infinity;
      const visualMape = result.metrics?.samplesByMethod['visual_estimate']?.mape || Infinity;
      expect(calibratedMape).toBeLessThan(visualMape);
    });
  });

  describe('evaluateByGeometry()', () => {
    it('should filter and evaluate by specific geometry', () => {
      const result = evaluator.evaluateByGeometry(allSamples, 'discrete_unit');
      expect(result.success).toBe(true);
      expect(result.metrics?.count).toBe(3);
    });

    it('should error on non-existent category', () => {
      const result = evaluator.evaluateByGeometry(allSamples, 'nonexistent');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_SAMPLES_FOR_CATEGORY');
    });
  });

  describe('evaluateByMethod()', () => {
    it('should filter and evaluate by estimation method', () => {
      const result = evaluator.evaluateByMethod(allSamples, 'discrete_unit_calibrated');
      expect(result.success).toBe(true);
      expect(result.metrics?.count).toBe(3);
    });

    it('should error on non-existent method', () => {
      const result = evaluator.evaluateByMethod(allSamples, 'unknown_method');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_SAMPLES_FOR_METHOD');
    });
  });

  describe('compareEstimationMethods()', () => {
    it('should compare two estimation methods', () => {
      const result = evaluator.compareEstimationMethods(
        allSamples,
        'discrete_unit_calibrated',
        'visual_estimate'
      );
      expect(result.method1.success).toBe(true);
      expect(result.method2.success).toBe(true);
      expect(result.better).toBe('discrete_unit_calibrated');
    });
  });

  describe('error handling', () => {
    it('should error on empty samples array', () => {
      const result = evaluator.evaluate([]);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMPTY_SAMPLES');
    });

    it('should error on null samples', () => {
      const result = evaluator.evaluate(null as any);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMPTY_SAMPLES');
    });

    it('should handle single sample', () => {
      const result = evaluator.evaluate(singleSample);
      expect(result.success).toBe(true);
      expect(result.metrics?.count).toBe(1);
      expect(result.metrics?.mae).toBeGreaterThan(0);
    });
  });

  describe('rounding precision', () => {
    it('should round metrics to 1 decimal place', () => {
      const result = evaluator.evaluate(allSamples);
      expect(result.success).toBe(true);
      const mae = result.metrics?.mae?.toString() || '';
      const decimalCount = (mae.split('.')[1] || '').length;
      expect(decimalCount).toBeLessThanOrEqual(1);
    });
  });
});
