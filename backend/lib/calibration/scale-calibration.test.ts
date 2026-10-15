import { describe, it, expect } from 'vitest';
import {
  attemptScaleCalibration,
  attachCalibrationToResult,
} from './scale-calibration';
import type { CaptureMetadata } from '@/lib/validation/schemas';
import type { FoodRecognitionResult, DetectedMarker } from '@/lib/food/types';

/**
 * Helper to create a valid CaptureMetadata with calibration enabled.
 */
function createCalibrationEnabledMetadata(
  overrides?: Partial<CaptureMetadata>
): CaptureMetadata {
  return {
    version: 1,
    capturedAt: '2026-10-15T10:00:00Z',
    captureMode: 'camera',
    imageWidthPx: 1200,
    imageHeightPx: 1600,
    mimeType: 'image/jpeg',
    orientation: 'portrait',
    compressionQuality: 0.9,
    exifStripped: true,
    referenceCalibration: {
      version: 1,
      enabled: true,
      selectedMarkerType: 'credit_card',
      statusMessage: 'Credit card calibration enabled',
    },
    disclaimer: 'Single RGB image — no depth data, no 3D reconstruction, no absolute scale.',
    ...overrides,
  };
}

/**
 * Helper to create a valid CaptureMetadata with calibration disabled.
 */
function createCalibrationDisabledMetadata(
  overrides?: Partial<CaptureMetadata>
): CaptureMetadata {
  return {
    version: 1,
    capturedAt: '2026-10-15T10:00:00Z',
    captureMode: 'gallery',
    imageWidthPx: 1200,
    imageHeightPx: 1600,
    mimeType: 'image/jpeg',
    exifStripped: true,
    referenceCalibration: {
      enabled: false,
    },
    disclaimer: 'Single RGB image — no depth data, no 3D reconstruction, no absolute scale.',
    ...overrides,
  };
}

/**
 * Helper to create a food recognition result with a detected marker.
 *
 * Default box2d creates a 200px × 126px box in a 1200×1600 image:
 * - ymin=100 → 100/1000*1600 = 160px
 * - ymax=226 → 226/1000*1600 = 361.6px
 * - xmin=100 → 100/1000*1200 = 120px
 * - xmax=300 → 300/1000*1200 = 360px
 * Width: 360-120=240px, Height: 361.6-160≈201.6px
 * Aspect ratio: 240/201.6 ≈ 1.19 (hmm, still not quite right)
 *
 * Better: for credit card (aspect 1.585), use box2d that gives ~250px × 157px
 * In 1200×1600 image:
 * - Height 157px → 157/1600 * 1000 ≈ 98 to 196 (98 px units)
 * - Width 250px → 250/1200 * 1000 ≈ 104 to 312 (208 px units)
 */
function createResultWithMarker(
  markerType: string = 'credit_card',
  confidence: number = 0.85,
  box2d: [number, number, number, number] = [100, 100, 297, 308]
): FoodRecognitionResult {
  const detectedMarker: DetectedMarker = {
    markerType: markerType as any,
    confidence,
    box2d,
  };

  return {
    items: [
      {
        name: 'banana',
        canonicalName: 'banana',
        confidence: 0.9,
        description: 'A yellow banana',
        estimatedPortion: '1 medium',
        estimatedGrams: 120,
        foodGeometryCategory: 'discrete_unit',
        sizeTier: 'medium',
        heightProfile: 'elongated',
        itemCount: 1,
        visualScaleCue: 'Banana placed next to credit card',
        box2d: [50, 100, 400, 600],
      },
    ],
    imageQuality: 'good',
    detectedMarker,
  };
}

/**
 * Helper to create a food recognition result without a detected marker.
 */
function createResultWithoutMarker(): FoodRecognitionResult {
  return {
    items: [
      {
        name: 'apple',
        canonicalName: 'apple',
        confidence: 0.88,
        description: 'A red apple',
        estimatedPortion: '1 medium',
      },
    ],
    imageQuality: 'good',
  };
}

describe('Scale Calibration Service', () => {
  describe('attemptScaleCalibration', () => {
    it('should return success when marker is detected and valid', () => {
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 1000,
        imageHeightPx: 1000,
      });
      // For credit card (85.6 × 53.98 mm, aspect ratio ~1.585):
      // Use box2d that gives 250px × 157px (aspect ratio 1.592 ≈ 1.585)
      // In 1000×1000 image:
      // xmin=100 → 100px, xmax=350 → 350px (width=250px)
      // ymin=100 → 100px, ymax=257 → 257px (height=157px)
      // So box2d should be [100, 100, 257, 350]
      const result = createResultWithMarker('credit_card', 0.85, [100, 100, 257, 350]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(true);
      expect(calibration.validationStatus).toBe('success');
      expect(calibration.pixelsPerMmX).toBeDefined();
      expect(calibration.pixelsPerMmY).toBeDefined();
      expect(calibration.aspectRatio).toBeDefined();
      expect(calibration.markerType).toBe('credit_card');
      expect(calibration.confidence).toBe(0.85);
      expect(calibration.message).toContain('Calibration successful');
    });

    it('should reject marker with low confidence', () => {
      const metadata = createCalibrationEnabledMetadata();
      const result = createResultWithMarker('credit_card', 0.3); // Below 0.5 threshold

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('low_confidence');
      expect(calibration.message).toContain('below threshold');
    });

    it('should reject marker that is too small', () => {
      const metadata = createCalibrationEnabledMetadata();
      // box2d: [ymin, xmin, ymax, xmax] — very small bounds
      const result = createResultWithMarker('credit_card', 0.85, [100, 150, 105, 165]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('marker_too_small');
      expect(calibration.message).toContain('below minimum');
    });

    it('should reject marker with invalid aspect ratio', () => {
      const metadata = createCalibrationEnabledMetadata();
      // Credit card is 85.6 × 53.98 mm (aspect ratio ~1.585)
      // Create a box2d that would result in a very different aspect ratio
      // box2d: [100, 150, 350, 250] → 250px height, 100px width → aspect ratio 0.4
      const result = createResultWithMarker('credit_card', 0.85, [100, 150, 350, 250]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('invalid_aspect_ratio');
      expect(calibration.message).toContain('Aspect ratio mismatch');
    });

    it('should skip calibration when disabled in metadata', () => {
      const metadata = createCalibrationDisabledMetadata();
      const result = createResultWithMarker('credit_card', 0.85);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('no_marker_detected');
      expect(calibration.message).toContain('disabled');
    });

    it('should return no_marker_detected when marker is missing', () => {
      const metadata = createCalibrationEnabledMetadata();
      const result = createResultWithoutMarker();

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('no_marker_detected');
      expect(calibration.message).toContain('No reference marker detected');
    });

    it('should handle null calibration context gracefully', () => {
      const result = createResultWithMarker('credit_card', 0.85);

      const calibration = attemptScaleCalibration(result, null);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('no_marker_detected');
    });

    it('should handle undefined calibration context gracefully', () => {
      const result = createResultWithMarker('credit_card', 0.85);

      const calibration = attemptScaleCalibration(result, undefined);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('no_marker_detected');
    });

    it('should compute correct pixelsPerMm for credit card', () => {
      // Credit card: 85.6 × 53.98 mm
      // If detected as 200px × 130px:
      // pixelsPerMmX = 200 / 85.6 ≈ 2.336
      // pixelsPerMmY = 130 / 53.98 ≈ 2.408
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 1000,
        imageHeightPx: 1000,
      });

      // Create box2d that normalizes to ~200px × 130px
      // In 1000x1000 image: xmin=100, xmax=300, ymin=100, ymax=230
      // That's 200px × 130px
      const result = createResultWithMarker('credit_card', 0.85, [100, 100, 230, 300]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(true);
      expect(calibration.pixelsPerMmX).toBeCloseTo(2.336, 2);
      expect(calibration.pixelsPerMmY).toBeCloseTo(2.408, 2);
      expect(calibration.aspectRatio).toBeCloseTo(0.97, 1); // Close to 1.0 = good
    });

    it('should handle custom marker dimensions', () => {
      const customDimensions = { widthMm: 100, heightMm: 50 };
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 1000,
        imageHeightPx: 1000,
        referenceCalibration: {
          version: 1,
          enabled: true,
          selectedMarkerType: 'custom',
          customDimensionsMm: customDimensions,
          statusMessage: 'Custom calibration marker',
        },
      });

      // box2d → 200px × 100px
      const result = createResultWithMarker('custom', 0.85, [100, 100, 200, 300]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(true);
      expect(calibration.pixelsPerMmX).toBe(2); // 200 / 100
      expect(calibration.pixelsPerMmY).toBe(2); // 100 / 50
    });

    it('should work with us_quarter marker', () => {
      // US quarter: 24.26 × 24.26 mm (circular)
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 1000,
        imageHeightPx: 1000,
        referenceCalibration: {
          version: 1,
          enabled: true,
          selectedMarkerType: 'us_quarter',
          statusMessage: 'US quarter detected',
        },
      });

      // box2d → 100px × 100px (circular)
      const result = createResultWithMarker('us_quarter', 0.9, [200, 200, 300, 300]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(true);
      expect(calibration.pixelsPerMmX).toBeCloseTo(4.125, 2); // 100 / 24.26
      expect(calibration.pixelsPerMmY).toBeCloseTo(4.125, 2);
      expect(calibration.aspectRatio).toBeCloseTo(1.0, 1); // Perfect circle
    });

    it('should validate calibration config values are set', () => {
      const metadata = createCalibrationEnabledMetadata();
      const result = createResultWithMarker('credit_card', 0.85);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.minConfidenceThreshold).toBe(0.5);
      expect(calibration.minMarkerSizePx).toBe(20);
      expect(calibration.aspectRatioTolerancePercent).toBe(20);
    });

    it('should reject marker below confidence threshold', () => {
      const metadata = createCalibrationEnabledMetadata();
      const result = createResultWithMarker('credit_card', 0.49); // Below 0.5 threshold

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('low_confidence');
    });

    it('should accept marker at exactly confidence threshold', () => {
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 1000,
        imageHeightPx: 1000,
      });
      // Use valid credit card box2d: [100, 100, 257, 350]
      const result = createResultWithMarker('credit_card', 0.5, [100, 100, 257, 350]);

      const calibration = attemptScaleCalibration(result, metadata);

      // Should accept because confidence >= threshold (0.5 is NOT < 0.5)
      expect(calibration.success).toBe(true);
      expect(calibration.validationStatus).toBe('success');
    });

    it('should accept marker just above confidence threshold', () => {
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 1000,
        imageHeightPx: 1000,
      });
      // Use valid credit card box2d: [100, 100, 257, 350]
      const result = createResultWithMarker('credit_card', 0.501, [100, 100, 257, 350]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(true);
      expect(calibration.validationStatus).toBe('success');
    });

    it('should normalize box2d correctly from 0-1000 scale', () => {
      // This test verifies that box2d normalization works correctly
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 800,
        imageHeightPx: 600,
      });

      // box2d: [0, 0, 500, 500] → should give 300px × 250px
      // (ymin=0 → 0px, ymax=500 → 300px, xmin=0 → 0px, xmax=500 → 400px)
      const result = createResultWithMarker('credit_card', 0.85, [0, 0, 500, 500]);

      const calibration = attemptScaleCalibration(result, metadata);

      // Credit card aspect ratio: 85.6/53.98 ≈ 1.585
      // Detected: 400/300 ≈ 1.333 — within 20% tolerance?
      // |(1.333 - 1.585) / 1.585| * 100 ≈ 15.9% — YES
      expect(calibration.success).toBe(true);
    });

    it('should handle different marker types (us_penny)', () => {
      // US penny: 19.05 × 19.05 mm
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 500,
        imageHeightPx: 500,
        referenceCalibration: {
          version: 1,
          enabled: true,
          selectedMarkerType: 'us_penny',
          statusMessage: 'US penny detected',
        },
      });

      // box2d → 80px × 80px
      const result = createResultWithMarker('us_penny', 0.88, [100, 100, 260, 260]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(true);
      expect(calibration.pixelsPerMmX).toBeCloseTo(4.2, 1); // 80 / 19.05
      expect(calibration.pixelsPerMmY).toBeCloseTo(4.2, 1);
    });

    it('should handle different marker types (one_euro_coin)', () => {
      // €1 coin: 23.25 × 23.25 mm
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 600,
        imageHeightPx: 600,
        referenceCalibration: {
          version: 1,
          enabled: true,
          selectedMarkerType: 'one_euro_coin',
          statusMessage: '€1 coin detected',
        },
      });

      // box2d → 120px × 120px
      const result = createResultWithMarker('one_euro_coin', 0.92, [100, 100, 300, 300]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(true);
      expect(calibration.pixelsPerMmX).toBeCloseTo(5.16, 1); // 120 / 23.25
    });
  });

  describe('attachCalibrationToResult', () => {
    it('should attach calibration summary to result', () => {
      const result = createResultWithoutMarker();
      const metadata = createCalibrationEnabledMetadata();
      const summary = attemptScaleCalibration(result, metadata);

      const resultWithCalibration = attachCalibrationToResult(result, summary);

      expect(resultWithCalibration.calibration).toBe(summary);
      expect(resultWithCalibration.items).toEqual(result.items);
      expect(resultWithCalibration.imageQuality).toBe(result.imageQuality);
    });

    it('should preserve all result properties when attaching calibration', () => {
      const result = createResultWithMarker();
      const metadata = createCalibrationEnabledMetadata();
      const summary = attemptScaleCalibration(result, metadata);

      const resultWithCalibration = attachCalibrationToResult(result, summary);

      expect(resultWithCalibration.items.length).toBe(result.items.length);
      expect(resultWithCalibration.detectedMarker).toEqual(result.detectedMarker);
      expect(resultWithCalibration.message).toEqual(result.message);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle invalid box2d (out of range)', () => {
      const metadata = createCalibrationEnabledMetadata();
      // box2d with value > 1000 (invalid)
      const result = createResultWithMarker('credit_card', 0.85, [100, 150, 1100, 350]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('invalid_box2d');
    });

    it('should handle invalid box2d (negative values)', () => {
      const metadata = createCalibrationEnabledMetadata();
      const result = createResultWithMarker('credit_card', 0.85, [-50, 150, 300, 350]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('invalid_box2d');
    });

    it('should compute aspect ratio correctly for squished marker', () => {
      const metadata = createCalibrationEnabledMetadata({
        imageWidthPx: 1000,
        imageHeightPx: 1000,
      });

      // box2d that creates 300px width, 100px height (highly distorted)
      // Aspect ratio: 3.0 — credit card is 1.585 — very different
      const result = createResultWithMarker('credit_card', 0.85, [200, 100, 300, 400]);

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.success).toBe(false);
      expect(calibration.validationStatus).toBe('invalid_aspect_ratio');
    });

    it('should include validation thresholds in response', () => {
      const metadata = createCalibrationEnabledMetadata();
      const result = createResultWithoutMarker();

      const calibration = attemptScaleCalibration(result, metadata);

      expect(calibration.minConfidenceThreshold).toEqual(0.5);
      expect(calibration.minMarkerSizePx).toEqual(20);
      expect(calibration.aspectRatioTolerancePercent).toEqual(20);
    });
  });
});
