/**
 * Portion-Mass Estimator
 *
 * Calculates estimated mass (grams) and uncertainty bounds for food items
 * using either:
 *
 * 1. **Discrete unit estimation** (apples, bananas, eggs, bread slices):
 *    - Look up standard unit weight from food-density.ts
 *    - Multiply by itemCount to get total mass
 *    - Assign ±15% uncertainty if calibrated, ±25% if visual only
 *
 * 2. **Calibrated volume estimation** (soups, mounds, slabs):
 *    - Convert item's bounding box (0–1000 scale) to pixel dimensions
 *    - Convert pixels to real-world cm² using pixelsPerMm from calibration
 *    - Multiply 2D area × height profile estimate (cm) to get volume (cm³)
 *    - Multiply volume × food density (g/cm³) to get mass (grams)
 *    - Assign ±20% uncertainty (calibrated)
 *
 * 3. **Uncalibrated fallback** (no scale marker detected):
 *    - Use Gemini's AI visual estimate (`item.estimatedGrams`) if available
 *    - Otherwise fall back to standard portion lookup
 *    - Assign ±35% uncertainty (visual estimate)
 *
 * This service does NOT scale nutrition data — that's done by the caller
 * using the returned `estimatedGrams` value.
 */

import type { FoodRecognitionResult } from '@/lib/food/types';
import type { FoodItem } from '@/lib/food/types';
import type { CalibrationSummary } from '@/lib/calibration/scale-calibration';
import {
  getFoodDensity,
  getUnitWeight,
  FALLBACK_UNIT_WEIGHT_GRAMS,
} from '@/lib/nutrition/food-density';

/**
 * Height profile estimates (in centimeters) for different food shapes.
 *
 * These are typical heights for foods with different visual profiles,
 * used to convert 2D area into 3D volume. Based on culinary observations.
 *
 * Examples:
 * - A flat thin layer (rice on a plate): ~1 cm
 * - A low mound (mashed potatoes): ~2.2 cm
 * - A medium dome (cooked pasta, stir-fry): ~3.5 cm
 * - A high heaped serving: ~5 cm
 * - A bowl of liquid: ~4 cm
 */
const HEIGHT_PROFILE_CM: Record<string, number> = {
  flat_thin: 1.0,
  flat: 1.0,
  low_mound: 2.2,
  medium_dome: 3.5,
  medium: 3.5,
  high_heaped: 5.0,
  peaked: 5.0,
  deep_bowl: 4.0,
  bowl: 4.0,
  rounded: 3.5,
  irregular: 3.0,
};

/**
 * Result of mass estimation for a food item.
 */
export interface MassEstimateResult {
  /** Estimated mass in grams */
  estimatedGrams: number;

  /** Uncertainty range in grams (±) */
  uncertaintyGrams: number;

  /** How the estimate was computed */
  estimationMethod:
    | 'discrete_unit_calibrated'
    | 'discrete_unit_visual'
    | 'volume_calibrated'
    | 'volume_visual'
    | 'fallback_ai_visual'
    | 'fallback_standard_portion';

  /** Descriptive message for debugging */
  description: string;

  /** Confidence level: high, medium, or low */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Estimate the mass (in grams) of a food item.
 *
 * @param item - Recognized food item with geometry information
 * @param calibration - Optional calibration summary (pixelsPerMm, marker type, etc.)
 * @param imageWidthPx - Image width in pixels (required if calibration present)
 * @param imageHeightPx - Image height in pixels (required if calibration present)
 * @returns Mass estimate with uncertainty and method
 */
export function estimateFoodMass(
  item: FoodItem,
  calibration: CalibrationSummary | undefined,
  imageWidthPx: number,
  imageHeightPx: number
): MassEstimateResult {
  // Route based on food geometry category
  if (item.foodGeometryCategory === 'discrete_unit') {
    return estimateDiscreteUnitMass(item, calibration?.success ?? false);
  }

  if (
    item.foodGeometryCategory === 'amorphous_mound' ||
    item.foodGeometryCategory === 'solid_slab' ||
    item.foodGeometryCategory === 'liquid_or_bowl'
  ) {
    if (calibration?.success && calibration.pixelsPerMmX && calibration.pixelsPerMmY) {
      // Calibrated volume estimation
      return estimateCalibratedVolumeMass(
        item,
        calibration.pixelsPerMmX,
        calibration.pixelsPerMmY,
        imageWidthPx,
        imageHeightPx
      );
    }

    // Uncalibrated fallback
    return estimateUncalibratedVolumeMass(item);
  }

  // Unknown category — fallback
  return fallbackMassEstimate(item);
}

/**
 * Estimate mass for discrete unit items (apples, bananas, eggs, bread slices).
 *
 * Uses standard unit weights from food-density.ts.
 *
 * @param item - Food item
 * @param isCalibrated - Whether the food photo was calibrated with a reference marker
 * @returns Mass estimate
 */
function estimateDiscreteUnitMass(
  item: FoodItem,
  isCalibrated: boolean
): MassEstimateResult {
  // Determine size tier (small, medium, large)
  const sizeTier = (item.sizeTier as 'small' | 'medium' | 'large') || 'medium';

  // Look up standard unit weight
  const unitWeightGrams = getUnitWeight(item.name, sizeTier);

  if (unitWeightGrams === null) {
    // Not in lookup table — use fallback
    return fallbackMassEstimate(item);
  }

  // Multiply by item count
  const itemCount = item.itemCount ?? 1;
  const totalGrams = unitWeightGrams * itemCount;

  // Uncertainty: ±15% if calibrated (reference marker confirms scale),
  // ±25% if visual only
  const uncertaintyPercent = isCalibrated ? 0.15 : 0.25;
  const uncertaintyGrams = totalGrams * uncertaintyPercent;

  return {
    estimatedGrams: totalGrams,
    uncertaintyGrams,
    estimationMethod: isCalibrated ? 'discrete_unit_calibrated' : 'discrete_unit_visual',
    description: `${itemCount} × ${item.name} (${sizeTier}) = ${unitWeightGrams}g × ${itemCount}`,
    confidence: isCalibrated ? 'high' : 'medium',
  };
}

/**
 * Estimate mass for volume-based foods using calibrated 2D scale (requires reference marker).
 *
 * Formula:
 *   Volume (cm³) = Area (cm²) × Height (cm)
 *   Mass (g) = Volume (cm³) × Density (g/cm³)
 *
 * @param item - Food item with bounding box and height profile
 * @param pixelsPerMmX - Horizontal scale from calibration (pixels/mm)
 * @param pixelsPerMmY - Vertical scale from calibration (pixels/mm)
 * @param imageWidthPx - Image width in pixels
 * @param imageHeightPx - Image height in pixels
 * @returns Mass estimate
 */
function estimateCalibratedVolumeMass(
  item: FoodItem,
  pixelsPerMmX: number,
  pixelsPerMmY: number,
  imageWidthPx: number,
  imageHeightPx: number
): MassEstimateResult {
  // Step 1: Convert box2d (0–1000 scale) to pixel bounds
  if (!item.box2d || item.box2d.length !== 4) {
    return fallbackMassEstimate(item);
  }

  const [ymin, xmin, ymax, xmax] = item.box2d;
  const xMinPx = Math.round((xmin / 1000) * imageWidthPx);
  const xMaxPx = Math.round((xmax / 1000) * imageWidthPx);
  const yMinPx = Math.round((ymin / 1000) * imageHeightPx);
  const yMaxPx = Math.round((ymax / 1000) * imageHeightPx);

  const widthPx = xMaxPx - xMinPx;
  const heightPx = yMaxPx - yMinPx;

  if (widthPx <= 0 || heightPx <= 0) {
    return fallbackMassEstimate(item);
  }

  // Step 2: Convert pixel dimensions to millimeters, then centimeters
  const widthMm = widthPx / pixelsPerMmX;
  const heightMm = heightPx / pixelsPerMmY;

  const widthCm = widthMm / 10;
  const heightCm = heightMm / 10;

  // Step 3: Compute 2D area in cm²
  const areaCm2 = widthCm * heightCm;

  // Step 4: Get height profile estimate
  const profileKey = item.heightProfile?.toLowerCase() || 'medium';
  const heightProfileCm = HEIGHT_PROFILE_CM[profileKey] ?? HEIGHT_PROFILE_CM['medium'];

  // Step 5: Compute volume in cm³
  const volumeCm3 = areaCm2 * heightProfileCm;

  // Step 6: Get food density and compute mass
  const densityGcm3 = getFoodDensity(item.name, item.foodGeometryCategory);
  const estimatedGrams = volumeCm3 * densityGcm3;

  // Clamp to reasonable range (0.5g to 5000g)
  const clampedGrams = Math.max(0.5, Math.min(5000, estimatedGrams));

  // Uncertainty: ±20% for calibrated volume estimate
  const uncertaintyGrams = clampedGrams * 0.2;

  return {
    estimatedGrams: clampedGrams,
    uncertaintyGrams,
    estimationMethod: 'volume_calibrated',
    description:
      `Area: ${areaCm2.toFixed(1)}cm², Height: ${heightProfileCm}cm, ` +
      `Volume: ${volumeCm3.toFixed(1)}cm³, Density: ${densityGcm3}g/cm³`,
    confidence: 'high',
  };
}

/**
 * Estimate mass for volume-based foods WITHOUT calibration (fallback).
 *
 * Uses either:
 * 1. Gemini's AI visual estimate (`item.estimatedGrams`)
 * 2. Fallback to standard portion size
 *
 * @param item - Food item
 * @returns Mass estimate with high uncertainty (visual only)
 */
function estimateUncalibratedVolumeMass(item: FoodItem): MassEstimateResult {
  // If Gemini provided an estimated mass, use it
  if (item.estimatedGrams && item.estimatedGrams > 0) {
    const uncertaintyGrams = item.estimatedGrams * 0.35; // ±35% for visual

    return {
      estimatedGrams: item.estimatedGrams,
      uncertaintyGrams,
      estimationMethod: 'volume_visual',
      description: `AI visual estimate: ${item.estimatedGrams}g (no scale calibration)`,
      confidence: 'low',
    };
  }

  // Fallback: use standard portion
  return fallbackMassEstimate(item);
}

/**
 * Fallback mass estimation when no better method is available.
 *
 * Uses a default portion size (150g) with high uncertainty (±35%).
 *
 * @param item - Food item
 * @returns Mass estimate
 */
function fallbackMassEstimate(item: FoodItem): MassEstimateResult {
  const estimatedGrams = FALLBACK_UNIT_WEIGHT_GRAMS;
  const uncertaintyGrams = estimatedGrams * 0.35; // ±35%

  return {
    estimatedGrams,
    uncertaintyGrams,
    estimationMethod: 'fallback_standard_portion',
    description: `Fallback: standard portion (${estimatedGrams}g)`,
    confidence: 'low',
  };
}

/**
 * Scale USDA nutrition data to match the estimated portion mass.
 *
 * Takes a base nutrition entry (per 100g from USDA) and scales all values
 * proportionally to the estimated portion mass.
 *
 * @param baseNutrition - Nutrition data per serving (typically 100g from USDA)
 * @param estimatedGrams - Estimated portion mass in grams
 * @param estimationMethod - How the mass was estimated (for metadata)
 * @param uncertaintyGrams - Uncertainty range (for metadata)
 * @returns Scaled nutrition data with mass estimation metadata
 */
export function scaleNutritionToMass(
  baseNutrition: any,
  estimatedGrams: number,
  estimationMethod: string,
  uncertaintyGrams: number
): any {
  // Determine the base serving size in grams (assume 100g if not specified)
  const baseSizingGrams = baseNutrition.servingSize === 100 || !baseNutrition.servingSize
    ? 100
    : parseFloat(baseNutrition.servingSize) || 100;

  // Calculate scale factor
  const scaleFactor = estimatedGrams / baseSizingGrams;

  // Scale all numeric nutrient fields proportionally
  const scaled = {
    ...baseNutrition,
    servingSize: estimatedGrams,
    servingUnit: 'g',
    calories: baseNutrition.calories ? Math.round(baseNutrition.calories * scaleFactor) : undefined,
    protein: baseNutrition.protein ? Math.round(baseNutrition.protein * scaleFactor * 10) / 10 : undefined,
    totalFat: baseNutrition.totalFat
      ? Math.round(baseNutrition.totalFat * scaleFactor * 10) / 10
      : undefined,
    saturatedFat: baseNutrition.saturatedFat
      ? Math.round(baseNutrition.saturatedFat * scaleFactor * 10) / 10
      : undefined,
    transFat: baseNutrition.transFat
      ? Math.round(baseNutrition.transFat * scaleFactor * 10) / 10
      : undefined,
    carbs: baseNutrition.carbs
      ? Math.round(baseNutrition.carbs * scaleFactor * 10) / 10
      : undefined,
    fiber: baseNutrition.fiber
      ? Math.round(baseNutrition.fiber * scaleFactor * 10) / 10
      : undefined,
    sugar: baseNutrition.sugar
      ? Math.round(baseNutrition.sugar * scaleFactor * 10) / 10
      : undefined,

    // Scale micronutrients if present
    calcium: baseNutrition.calcium
      ? Math.round(baseNutrition.calcium * scaleFactor * 10) / 10
      : undefined,
    iron: baseNutrition.iron ? Math.round(baseNutrition.iron * scaleFactor * 10) / 10 : undefined,
    magnesium: baseNutrition.magnesium
      ? Math.round(baseNutrition.magnesium * scaleFactor * 10) / 10
      : undefined,
    phosphorus: baseNutrition.phosphorus
      ? Math.round(baseNutrition.phosphorus * scaleFactor * 10) / 10
      : undefined,
    potassium: baseNutrition.potassium
      ? Math.round(baseNutrition.potassium * scaleFactor)
      : undefined,
    sodium: baseNutrition.sodium
      ? Math.round(baseNutrition.sodium * scaleFactor)
      : undefined,
    zinc: baseNutrition.zinc ? Math.round(baseNutrition.zinc * scaleFactor * 10) / 10 : undefined,
    copper: baseNutrition.copper
      ? Math.round(baseNutrition.copper * scaleFactor * 10) / 10
      : undefined,
    manganese: baseNutrition.manganese
      ? Math.round(baseNutrition.manganese * scaleFactor * 10) / 10
      : undefined,
    selenium: baseNutrition.selenium
      ? Math.round(baseNutrition.selenium * scaleFactor)
      : undefined,
    vitaminA: baseNutrition.vitaminA
      ? Math.round(baseNutrition.vitaminA * scaleFactor)
      : undefined,
    vitaminC: baseNutrition.vitaminC
      ? Math.round(baseNutrition.vitaminC * scaleFactor)
      : undefined,
    vitaminD: baseNutrition.vitaminD
      ? Math.round(baseNutrition.vitaminD * scaleFactor * 10) / 10
      : undefined,
    vitaminE: baseNutrition.vitaminE
      ? Math.round(baseNutrition.vitaminE * scaleFactor * 10) / 10
      : undefined,
    vitaminK: baseNutrition.vitaminK
      ? Math.round(baseNutrition.vitaminK * scaleFactor * 10) / 10
      : undefined,
    vitaminB1: baseNutrition.vitaminB1
      ? Math.round(baseNutrition.vitaminB1 * scaleFactor * 10) / 10
      : undefined,
    vitaminB2: baseNutrition.vitaminB2
      ? Math.round(baseNutrition.vitaminB2 * scaleFactor * 10) / 10
      : undefined,
    vitaminB3: baseNutrition.vitaminB3
      ? Math.round(baseNutrition.vitaminB3 * scaleFactor * 10) / 10
      : undefined,
    vitaminB5: baseNutrition.vitaminB5
      ? Math.round(baseNutrition.vitaminB5 * scaleFactor * 10) / 10
      : undefined,
    vitaminB6: baseNutrition.vitaminB6
      ? Math.round(baseNutrition.vitaminB6 * scaleFactor * 10) / 10
      : undefined,
    vitaminB9: baseNutrition.vitaminB9
      ? Math.round(baseNutrition.vitaminB9 * scaleFactor)
      : undefined,
    vitaminB12: baseNutrition.vitaminB12
      ? Math.round(baseNutrition.vitaminB12 * scaleFactor * 10) / 10
      : undefined,

    // Add mass estimation metadata
    massEstimationMethod: estimationMethod,
    estimatedGrams,
    uncertaintyGrams,
  };

  // Remove undefined values to keep response clean
  Object.keys(scaled).forEach((key) => {
    if (scaled[key] === undefined) {
      delete scaled[key];
    }
  });

  return scaled;
}
