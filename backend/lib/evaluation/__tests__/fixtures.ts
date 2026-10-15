/**
 * Test Fixtures for Accuracy Evaluator
 *
 * Mock weighed food samples representing real-world scenarios
 */

import type { WeighedFoodSample } from '../types';

/**
 * High-accuracy calibrated measurements (discrete units)
 */
export const calibratedDiscreteUnitSamples: WeighedFoodSample[] = [
  {
    predictedGrams: 150,
    actualGrams: 152,
    foodGeometryCategory: 'discrete_unit',
    estimationMethod: 'discrete_unit_calibrated',
    confidence: 'high',
    uncertaintyGrams: 10,
  },
  {
    predictedGrams: 200,
    actualGrams: 198,
    foodGeometryCategory: 'discrete_unit',
    estimationMethod: 'discrete_unit_calibrated',
    confidence: 'high',
    uncertaintyGrams: 10,
  },
  {
    predictedGrams: 180,
    actualGrams: 182,
    foodGeometryCategory: 'discrete_unit',
    estimationMethod: 'discrete_unit_calibrated',
    confidence: 'high',
    uncertaintyGrams: 10,
  },
];

/**
 * Volume-calibrated measurements (amorphous mounds)
 */
export const calibratedVolumeSamples: WeighedFoodSample[] = [
  {
    predictedGrams: 120,
    actualGrams: 115,
    foodGeometryCategory: 'amorphous_mound',
    estimationMethod: 'volume_calibrated',
    confidence: 'high',
    uncertaintyGrams: 15,
  },
  {
    predictedGrams: 280,
    actualGrams: 295,
    foodGeometryCategory: 'amorphous_mound',
    estimationMethod: 'volume_calibrated',
    confidence: 'high',
    uncertaintyGrams: 25,
  },
  {
    predictedGrams: 150,
    actualGrams: 148,
    foodGeometryCategory: 'amorphous_mound',
    estimationMethod: 'volume_calibrated',
    confidence: 'high',
    uncertaintyGrams: 15,
  },
];

/**
 * Visual estimation (lower accuracy)
 */
export const visualEstimateSamples: WeighedFoodSample[] = [
  {
    predictedGrams: 200,
    actualGrams: 175,
    foodGeometryCategory: 'solid_slab',
    estimationMethod: 'visual_estimate',
    confidence: 'medium',
    uncertaintyGrams: 35,
  },
  {
    predictedGrams: 150,
    actualGrams: 165,
    foodGeometryCategory: 'solid_slab',
    estimationMethod: 'visual_estimate',
    confidence: 'medium',
    uncertaintyGrams: 35,
  },
  {
    predictedGrams: 300,
    actualGrams: 280,
    foodGeometryCategory: 'solid_slab',
    estimationMethod: 'visual_estimate',
    confidence: 'medium',
    uncertaintyGrams: 35,
  },
];

/**
 * Liquid/bowl measurements (moderate accuracy)
 */
export const liquidBowlSamples: WeighedFoodSample[] = [
  {
    predictedGrams: 240,
    actualGrams: 250,
    foodGeometryCategory: 'liquid_or_bowl',
    estimationMethod: 'volume_calibrated',
    confidence: 'high',
    uncertaintyGrams: 20,
  },
  {
    predictedGrams: 180,
    actualGrams: 175,
    foodGeometryCategory: 'liquid_or_bowl',
    estimationMethod: 'volume_calibrated',
    confidence: 'high',
    uncertaintyGrams: 20,
  },
  {
    predictedGrams: 320,
    actualGrams: 330,
    foodGeometryCategory: 'liquid_or_bowl',
    estimationMethod: 'volume_calibrated',
    confidence: 'high',
    uncertaintyGrams: 20,
  },
];

/**
 * Combined sample set for overall testing
 */
export const allSamples: WeighedFoodSample[] = [
  ...calibratedDiscreteUnitSamples,
  ...calibratedVolumeSamples,
  ...visualEstimateSamples,
  ...liquidBowlSamples,
];

/**
 * Edge case: single sample
 */
export const singleSample: WeighedFoodSample[] = [
  {
    predictedGrams: 100,
    actualGrams: 105,
    foodGeometryCategory: 'discrete_unit',
    estimationMethod: 'discrete_unit_calibrated',
    confidence: 'high',
  },
];

/**
 * Edge case: perfect predictions
 */
export const perfectPredictions: WeighedFoodSample[] = [
  {
    predictedGrams: 150,
    actualGrams: 150,
    foodGeometryCategory: 'discrete_unit',
    estimationMethod: 'discrete_unit_calibrated',
    confidence: 'high',
  },
  {
    predictedGrams: 200,
    actualGrams: 200,
    foodGeometryCategory: 'discrete_unit',
    estimationMethod: 'discrete_unit_calibrated',
    confidence: 'high',
  },
];

/**
 * Edge case: high variance predictions
 */
export const highVariancePredictions: WeighedFoodSample[] = [
  {
    predictedGrams: 100,
    actualGrams: 200,
    foodGeometryCategory: 'discrete_unit',
    estimationMethod: 'visual_estimate',
    confidence: 'low',
  },
  {
    predictedGrams: 300,
    actualGrams: 150,
    foodGeometryCategory: 'discrete_unit',
    estimationMethod: 'visual_estimate',
    confidence: 'low',
  },
];
