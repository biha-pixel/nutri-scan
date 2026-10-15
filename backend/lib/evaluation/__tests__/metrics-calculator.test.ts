/**
 * Metrics Calculator Tests
 *
 * Unit tests for individual metric calculation functions
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMAE,
  calculateMAPE,
  calculateWMAPE,
  calculateRMSE,
  roundMetric,
} from '../metrics-calculator';
import type { WeighedFoodSample } from '../types';

describe('MetricsCalculator', () => {
  describe('calculateMAE', () => {
    it('should calculate mean absolute error correctly', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 100,
          actualGrams: 110,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
        {
          predictedGrams: 200,
          actualGrams: 195,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      // Errors: |100-110| = 10, |200-195| = 5
      // MAE = (10 + 5) / 2 = 7.5
      expect(calculateMAE(samples)).toBe(7.5);
    });

    it('should handle perfect predictions', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 150,
          actualGrams: 150,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      expect(calculateMAE(samples)).toBe(0);
    });

    it('should handle single sample', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 80,
          actualGrams: 100,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      expect(calculateMAE(samples)).toBe(20);
    });
  });

  describe('calculateMAPE', () => {
    it('should calculate mean absolute percentage error', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 100,
          actualGrams: 100,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
        {
          predictedGrams: 200,
          actualGrams: 250,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      // Errors: |100-100|/100 = 0%, |200-250|/250 = 20%
      // MAPE = (0 + 20) / 2 = 10%
      expect(calculateMAPE(samples)).toBe(10);
    });

    it('should handle zero actual mass gracefully', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 100,
          actualGrams: 100,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      // Single sample with no division by zero
      expect(calculateMAPE(samples)).toBe(0);
    });

    it('should return large percentage for bad prediction', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 50,
          actualGrams: 200,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      // |50-200|/200 = 150/200 = 75%
      expect(calculateMAPE(samples)).toBe(75);
    });
  });

  describe('calculateWMAPE', () => {
    it('should calculate weighted mean absolute percentage error', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 100,
          actualGrams: 100,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
        {
          predictedGrams: 200,
          actualGrams: 300,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      // Errors: |100-100| = 0, |200-300| = 100
      // Sum of errors: 100
      // Sum of actual: 100 + 300 = 400
      // WMAPE = (100 / 400) * 100 = 25%
      expect(calculateWMAPE(samples)).toBe(25);
    });

    it('should weight larger portions more heavily', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 100,
          actualGrams: 100,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
        {
          predictedGrams: 90,
          actualGrams: 1000,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      // Errors: 0, 910
      // Sum of errors: 910
      // Sum of actual: 1100
      // WMAPE = (910 / 1100) * 100 ≈ 82.73%
      expect(calculateWMAPE(samples)).toBeCloseTo(82.73, 1);
    });
  });

  describe('calculateRMSE', () => {
    it('should calculate root mean square error', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 100,
          actualGrams: 110,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
        {
          predictedGrams: 200,
          actualGrams: 200,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      // Squared errors: (100-110)^2 = 100, (200-200)^2 = 0
      // MSE = (100 + 0) / 2 = 50
      // RMSE = sqrt(50) ≈ 7.071
      expect(calculateRMSE(samples)).toBeCloseTo(7.071, 2);
    });

    it('should handle perfect predictions', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 150,
          actualGrams: 150,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      expect(calculateRMSE(samples)).toBe(0);
    });

    it('should penalize large errors more than small errors', () => {
      const smallErrors: WeighedFoodSample[] = [
        {
          predictedGrams: 100,
          actualGrams: 101,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      const largeErrors: WeighedFoodSample[] = [
        {
          predictedGrams: 100,
          actualGrams: 110,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'test',
          confidence: 'high',
        },
      ];
      const smallRMSE = calculateRMSE(smallErrors);
      const largeRMSE = calculateRMSE(largeErrors);
      expect(largeRMSE).toBeGreaterThan(smallRMSE);
      expect(largeRMSE / smallRMSE).toBeGreaterThan(9); // 10x error should give ~10x RMSE
    });
  });

  describe('roundMetric', () => {
    it('should round to 1 decimal place', () => {
      expect(roundMetric(12.456)).toBe(12.5);
      expect(roundMetric(12.444)).toBe(12.4);
      expect(roundMetric(12.5)).toBe(12.5);
    });

    it('should handle whole numbers', () => {
      expect(roundMetric(12)).toBe(12);
      expect(roundMetric(100)).toBe(100);
    });

    it('should round zero correctly', () => {
      expect(roundMetric(0)).toBe(0);
      expect(roundMetric(0.001)).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(roundMetric(-12.456)).toBe(-12.5);
      expect(roundMetric(-12.444)).toBe(-12.4);
    });
  });

  describe('integration with real-world scenarios', () => {
    it('should handle mixed geometry types', () => {
      const samples: WeighedFoodSample[] = [
        {
          predictedGrams: 150,
          actualGrams: 152,
          foodGeometryCategory: 'discrete_unit',
          estimationMethod: 'calibrated',
          confidence: 'high',
        },
        {
          predictedGrams: 200,
          actualGrams: 175,
          foodGeometryCategory: 'amorphous_mound',
          estimationMethod: 'visual',
          confidence: 'medium',
        },
        {
          predictedGrams: 300,
          actualGrams: 280,
          foodGeometryCategory: 'liquid_or_bowl',
          estimationMethod: 'calibrated',
          confidence: 'high',
        },
      ];
      const mae = calculateMAE(samples);
      const mape = calculateMAPE(samples);
      const wmape = calculateWMAPE(samples);
      const rmse = calculateRMSE(samples);

      expect(mae).toBeGreaterThan(0);
      expect(mape).toBeGreaterThan(0);
      expect(wmape).toBeGreaterThan(0);
      expect(rmse).toBeGreaterThan(0);
      expect(wmape).toBeLessThan(100); // Should be less than 100% on average
    });
  });
});
