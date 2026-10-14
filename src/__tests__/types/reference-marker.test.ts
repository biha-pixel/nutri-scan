/**
 * Reference Marker Calibration Tests
 *
 * Tests for marker dimension handling, calibration math, and validation logic.
 * These tests verify the core calculations and validation rules.
 *
 * NOTE: Run with Jest. TypeScript types are declared inline with JSDoc.
 * To run: npm test -- reference-marker.test.ts
 */

import {
  REFERENCE_MARKER_SPECS,
  createDetectionConfidence,
  computeImagePlaneCalibration,
  createPlaceholderCalibration,
  type MarkerDetectionResult,
  type MarkerPixelBounds,
  type ReferenceMarkerDimensions,
} from '@/types/reference-marker';

// Jest type declarations (no @types/jest dep needed for basic tests)
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare const expect: {
  (value: any): {
    toBe(expected: any): void;
    toBeCloseTo(expected: number, decimals?: number): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toContain(expected: any): void;
    toBeInstanceOf(expected: any): void;
  };
};

describe('Reference Marker Calibration', () => {
  describe('Marker Specifications', () => {
    it('defines standard credit card dimensions', () => {
      const cc = REFERENCE_MARKER_SPECS.credit_card;
      expect(cc.widthMm).toBe(85.6);
      expect(cc.heightMm).toBe(53.98);
      expect(cc.shape).toBe('rectangular');
    });

    it('defines standard US quarter dimensions', () => {
      const quarter = REFERENCE_MARKER_SPECS.us_quarter;
      expect(quarter.widthMm).toBe(24.26);
      expect(quarter.heightMm).toBe(24.26);
      expect(quarter.shape).toBe('circular');
    });

    it('defines standard one euro coin dimensions', () => {
      const euro = REFERENCE_MARKER_SPECS.one_euro_coin;
      expect(euro.widthMm).toBe(23.25);
      expect(euro.heightMm).toBe(23.25);
      expect(euro.shape).toBe('circular');
    });

    it('all marker specs have valid dimensions', () => {
      for (const [name, spec] of Object.entries(REFERENCE_MARKER_SPECS)) {
        expect(spec.widthMm).toBeGreaterThan(0);
        expect(spec.heightMm).toBeGreaterThan(0);
        expect(['rectangular', 'circular']).toContain(spec.shape);
      }
    });
  });

  describe('Detection Confidence', () => {
    it('clamps confidence to [0, 1]', () => {
      expect(createDetectionConfidence(-0.5)).toBe(0);
      expect(createDetectionConfidence(0)).toBe(0);
      expect(createDetectionConfidence(0.5)).toBe(0.5);
      expect(createDetectionConfidence(1)).toBe(1);
      expect(createDetectionConfidence(1.5)).toBe(1);
    });

    it('preserves valid confidence values', () => {
      const conf = createDetectionConfidence(0.75);
      expect(conf).toBe(0.75);
    });
  });

  describe('Image Plane Calibration Math', () => {
    it('computes correct pixels-per-mm for square marker', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: {
          x: 100,
          y: 100,
          widthPx: 242,
          heightPx: 242,
        },
        confidence: createDetectionConfidence(0.9),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.pixelsPerMmX).toBeCloseTo(242 / 24.26, 1);
      expect(calibration.pixelsPerMmY).toBeCloseTo(242 / 24.26, 1);
      expect(calibration.aspectRatio).toBeCloseTo(1.0, 2);
    });

    it('computes correct pixels-per-mm for rectangular marker', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'credit_card',
        dimensions: REFERENCE_MARKER_SPECS.credit_card,
        pixelBounds: {
          x: 50,
          y: 60,
          widthPx: 856,
          heightPx: 540,
        },
        confidence: createDetectionConfidence(0.85),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.pixelsPerMmX).toBeCloseTo(856 / 85.6, 1);
      expect(calibration.pixelsPerMmY).toBeCloseTo(540 / 53.98, 2);

      const expectedAspectRatio = (856 / 85.6) / (540 / 53.98);
      expect(calibration.aspectRatio).toBeCloseTo(expectedAspectRatio, 2);
    });

    it('detects aspect ratio distortion', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'credit_card',
        dimensions: REFERENCE_MARKER_SPECS.credit_card,
        pixelBounds: {
          x: 50,
          y: 60,
          widthPx: 900,
          heightPx: 400,
        },
        confidence: createDetectionConfidence(0.7),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.aspectRatio).toBeGreaterThan(1.8);
    });

    it('includes appropriate disclaimer in calibration', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'us_penny',
        dimensions: REFERENCE_MARKER_SPECS.us_penny,
        pixelBounds: {
          x: 150,
          y: 150,
          widthPx: 190,
          heightPx: 190,
        },
        confidence: createDetectionConfidence(0.9),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.disclaimer).toContain('Image-plane scale only');
      expect(calibration.disclaimer).toContain('No depth');
      expect(calibration.disclaimer).toContain('no volume estimation');
      expect(calibration.disclaimer).toContain('no mass inference');
    });

    it('computes pixels-to-millimeter conversion for food measurements', () => {
      const quarterDetection: MarkerDetectionResult = {
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: {
          x: 500,
          y: 400,
          widthPx: 242,
          heightPx: 242,
        },
        confidence: createDetectionConfidence(0.95),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(quarterDetection);

      const breadWidthPx = 121;
      const breadWidthMm = breadWidthPx / calibration.pixelsPerMmX;

      expect(breadWidthMm).toBeCloseTo(12.1, 1);
      expect(calibration.disclaimer).toContain('Image-plane scale only');
    });
  });

  describe('Placeholder Calibration', () => {
    it('creates placeholder when calibration is skipped', () => {
      const placeholder = createPlaceholderCalibration(
        false,
        'User skipped calibration'
      );

      expect(placeholder.version).toBe(1);
      expect(placeholder.calibrationEnabled).toBe(false);
      expect(placeholder.validationStatus).toBe('not_attempted');
      expect(placeholder.statusMessage).toBe('User skipped calibration');
      expect(placeholder.detection).toBeUndefined();
      expect(placeholder.calibration).toBeUndefined();
    });

    it('creates placeholder with pending status when enabled', () => {
      const placeholder = createPlaceholderCalibration(
        true,
        'Detecting marker in image...'
      );

      expect(placeholder.version).toBe(1);
      expect(placeholder.calibrationEnabled).toBe(true);
      expect(placeholder.validationStatus).toBe('pending');
      expect(placeholder.statusMessage).toContain('Detecting marker');
    });
  });

  describe('Marker Aspect Ratio Validation', () => {
    it('validates credit card with expected aspect ratio', () => {
      const widthPx = 856;
      const heightPx = 540;
      const detectedAspectRatio = widthPx / heightPx;

      const expectedDimensions = REFERENCE_MARKER_SPECS.credit_card;
      const expectedAspectRatio = expectedDimensions.widthMm / expectedDimensions.heightMm;

      const deviation = Math.abs(
        (detectedAspectRatio - expectedAspectRatio) / expectedAspectRatio
      );

      expect(deviation).toBeLessThan(0.05);
    });

    it('rejects credit card with severely distorted aspect ratio', () => {
      const widthPx = 1200;
      const heightPx = 300;
      const detectedAspectRatio = widthPx / heightPx;

      const expectedDimensions = REFERENCE_MARKER_SPECS.credit_card;
      const expectedAspectRatio = expectedDimensions.widthMm / expectedDimensions.heightMm;

      const deviation = Math.abs(
        (detectedAspectRatio - expectedAspectRatio) / expectedAspectRatio
      );

      expect(deviation).toBeGreaterThan(0.5);
    });
  });

  describe('Edge Cases', () => {
    it('handles very small detected marker', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: {
          x: 400,
          y: 400,
          widthPx: 5,
          heightPx: 5,
        },
        confidence: createDetectionConfidence(0.3),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.pixelsPerMmX).toBeDefined();
      expect(calibration.pixelsPerMmX).toBeGreaterThan(0);
    });

    it('handles marker at high magnification', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: {
          x: 0,
          y: 0,
          widthPx: 2400,
          heightPx: 2400,
        },
        confidence: createDetectionConfidence(0.95),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.pixelsPerMmX).toBeCloseTo(2400 / 24.26, 0);
      expect(calibration.pixelsPerMmY).toBeCloseTo(2400 / 24.26, 0);
    });

    it('handles marker at low magnification', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'ruler',
        dimensions: REFERENCE_MARKER_SPECS.ruler,
        pixelBounds: {
          x: 200,
          y: 100,
          widthPx: 30,
          heightPx: 3,
        },
        confidence: createDetectionConfidence(0.5),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      const pixelsPerMmX = 30 / 300;
      const pixelsPerMmY = 3 / 30;

      expect(calibration.pixelsPerMmX).toBeCloseTo(pixelsPerMmX, 2);
      expect(calibration.pixelsPerMmY).toBeCloseTo(pixelsPerMmY, 2);
    });

    it('handles zero-confidence detection', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'credit_card',
        dimensions: REFERENCE_MARKER_SPECS.credit_card,
        pixelBounds: {
          x: 100,
          y: 100,
          widthPx: 856,
          heightPx: 540,
        },
        confidence: createDetectionConfidence(0),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.pixelsPerMmX).toBeGreaterThan(0);
    });
  });

  describe('Food Measurement Examples', () => {
    it('measures food width using calibrated scale', () => {
      const quarterCalibration = computeImagePlaneCalibration({
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: { x: 100, y: 100, widthPx: 243, heightPx: 243 },
        confidence: createDetectionConfidence(0.9),
        detectedAt: new Date().toISOString(),
      });

      const foodWidthPx = 300;
      const foodWidthMm = foodWidthPx / quarterCalibration.pixelsPerMmX;

      expect(foodWidthMm).toBeCloseTo(30, 0);
    });

    it('does NOT compute volume from 2D scale', () => {
      const calibration = computeImagePlaneCalibration({
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: { x: 100, y: 100, widthPx: 243, heightPx: 243 },
        confidence: createDetectionConfidence(0.95),
        detectedAt: new Date().toISOString(),
      });

      expect(calibration.disclaimer).toContain('No volume estimation');
    });

    it('does NOT compute mass from pixel measurements', () => {
      const calibration = computeImagePlaneCalibration({
        markerType: 'credit_card',
        dimensions: REFERENCE_MARKER_SPECS.credit_card,
        pixelBounds: { x: 50, y: 60, widthPx: 856, heightPx: 540 },
        confidence: createDetectionConfidence(0.9),
        detectedAt: new Date().toISOString(),
      });

      expect(calibration.disclaimer).toContain('no mass inference');
    });
  });

  describe('Marker Specifications', () => {
    it('defines standard credit card dimensions', () => {
      const cc = REFERENCE_MARKER_SPECS.credit_card;
      expect(cc.widthMm).toBe(85.6);
      expect(cc.heightMm).toBe(53.98);
      expect(cc.shape).toBe('rectangular');
    });

    it('defines standard US quarter dimensions', () => {
      const quarter = REFERENCE_MARKER_SPECS.us_quarter;
      expect(quarter.widthMm).toBe(24.26);
      expect(quarter.heightMm).toBe(24.26);
      expect(quarter.shape).toBe('circular');
    });

    it('defines standard one euro coin dimensions', () => {
      const euro = REFERENCE_MARKER_SPECS.one_euro_coin;
      expect(euro.widthMm).toBe(23.25);
      expect(euro.heightMm).toBe(23.25);
      expect(euro.shape).toBe('circular');
    });

    it('all marker specs have valid dimensions', () => {
      for (const [name, spec] of Object.entries(REFERENCE_MARKER_SPECS)) {
        expect(spec.widthMm).toBeGreaterThan(0);
        expect(spec.heightMm).toBeGreaterThan(0);
        expect(['rectangular', 'circular']).toContain(spec.shape);
      }
    });
  });

  describe('Detection Confidence', () => {
    it('clamps confidence to [0, 1]', () => {
      expect(createDetectionConfidence(-0.5)).toBe(0);
      expect(createDetectionConfidence(0)).toBe(0);
      expect(createDetectionConfidence(0.5)).toBe(0.5);
      expect(createDetectionConfidence(1)).toBe(1);
      expect(createDetectionConfidence(1.5)).toBe(1);
    });

    it('preserves valid confidence values', () => {
      const conf = createDetectionConfidence(0.75);
      expect(conf).toBe(0.75);
    });
  });

  describe('Image Plane Calibration Math', () => {
    it('computes correct pixels-per-mm for square marker', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: {
          x: 100,
          y: 100,
          widthPx: 242, // ~10 pixels per mm (24.26 mm ÷ 242 px ≈ 0.1 mm/px)
          heightPx: 242,
        },
        confidence: createDetectionConfidence(0.9),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.pixelsPerMmX).toBeCloseTo(242 / 24.26, 1);
      expect(calibration.pixelsPerMmY).toBeCloseTo(242 / 24.26, 1);
      expect(calibration.aspectRatio).toBeCloseTo(1.0, 2); // Should be ~1 for square
    });

    it('computes correct pixels-per-mm for rectangular marker', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'credit_card',
        dimensions: REFERENCE_MARKER_SPECS.credit_card,
        pixelBounds: {
          x: 50,
          y: 60,
          widthPx: 856, // ~10 pixels per mm
          heightPx: 540,
        },
        confidence: createDetectionConfidence(0.85),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.pixelsPerMmX).toBeCloseTo(856 / 85.6, 1);
      expect(calibration.pixelsPerMmY).toBeCloseTo(540 / 53.98, 2);

      // Aspect ratio: (856/85.6) / (540/53.98)
      const expectedAspectRatio = (856 / 85.6) / (540 / 53.98);
      expect(calibration.aspectRatio).toBeCloseTo(expectedAspectRatio, 2);
    });

    it('detects aspect ratio distortion', () => {
      // Simulating a marker that is stretched (e.g., by perspective distortion)
      const detection: MarkerDetectionResult = {
        markerType: 'credit_card',
        dimensions: REFERENCE_MARKER_SPECS.credit_card,
        pixelBounds: {
          x: 50,
          y: 60,
          widthPx: 900, // Stretched horizontally
          heightPx: 400, // Compressed vertically
        },
        confidence: createDetectionConfidence(0.7),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      // Expected aspect ratio (credit card): 85.6 / 53.98 ≈ 1.585
      // Detected: 900 / 400 = 2.25
      // These are significantly different, indicating distortion
      expect(calibration.aspectRatio).toBeGreaterThan(1.8);
    });

    it('includes appropriate disclaimer in calibration', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'us_penny',
        dimensions: REFERENCE_MARKER_SPECS.us_penny,
        pixelBounds: {
          x: 150,
          y: 150,
          widthPx: 190,
          heightPx: 190,
        },
        confidence: createDetectionConfidence(0.9),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.disclaimer).toContain('Image-plane scale only');
      expect(calibration.disclaimer).toContain('No depth');
      expect(calibration.disclaimer).toContain('no volume estimation');
      expect(calibration.disclaimer).toContain('no mass inference');
    });

    it('computes pixels-to-millimeter conversion for food measurements', () => {
      // Simulating: user places a US quarter (24.26mm diameter) in the image
      // The quarter appears as 242 pixels, so scale is 10 pixels per mm
      const quarterDetection: MarkerDetectionResult = {
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: {
          x: 500,
          y: 400,
          widthPx: 242,
          heightPx: 242,
        },
        confidence: createDetectionConfidence(0.95),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(quarterDetection);

      // Now measure a food item: if a piece of bread is 121 pixels wide,
      // that translates to: 121 px / 10 px-per-mm = 12.1 mm width in image plane
      const breadWidthPx = 121;
      const breadWidthMm = breadWidthPx / calibration.pixelsPerMmX;

      expect(breadWidthMm).toBeCloseTo(12.1, 1);

      // IMPORTANT: This is image-plane width only, NOT a 3D size or volume claim
      expect(calibration.disclaimer).toContain('Image-plane scale only');
    });
  });

  describe('Placeholder Calibration', () => {
    it('creates placeholder when calibration is skipped', () => {
      const placeholder = createPlaceholderCalibration(
        false,
        'User skipped calibration'
      );

      expect(placeholder.version).toBe(1);
      expect(placeholder.calibrationEnabled).toBe(false);
      expect(placeholder.validationStatus).toBe('not_attempted');
      expect(placeholder.statusMessage).toBe('User skipped calibration');
      expect(placeholder.detection).toBeUndefined();
      expect(placeholder.calibration).toBeUndefined();
    });

    it('creates placeholder with pending status when enabled', () => {
      const placeholder = createPlaceholderCalibration(
        true,
        'Detecting marker in image...'
      );

      expect(placeholder.version).toBe(1);
      expect(placeholder.calibrationEnabled).toBe(true);
      expect(placeholder.validationStatus).toBe('pending');
      expect(placeholder.statusMessage).toContain('Detecting marker');
    });
  });

  describe('Marker Aspect Ratio Validation', () => {
    it('validates credit card with expected aspect ratio', () => {
      // Credit card: 85.6 × 53.98 mm ≈ 1.585 aspect ratio
      // If detected as 856 × 540 px, aspect ratio = 1.585 (match!)
      const widthPx = 856;
      const heightPx = 540;
      const detectedAspectRatio = widthPx / heightPx; // ~1.585

      const expectedDimensions = REFERENCE_MARKER_SPECS.credit_card;
      const expectedAspectRatio = expectedDimensions.widthMm / expectedDimensions.heightMm; // ~1.585

      const deviation = Math.abs(
        (detectedAspectRatio - expectedAspectRatio) / expectedAspectRatio
      );

      expect(deviation).toBeLessThan(0.05); // Should pass validation
    });

    it('rejects credit card with severely distorted aspect ratio', () => {
      // Severely stretched
      const widthPx = 1200;
      const heightPx = 300;
      const detectedAspectRatio = widthPx / heightPx; // 4.0

      const expectedDimensions = REFERENCE_MARKER_SPECS.credit_card;
      const expectedAspectRatio = expectedDimensions.widthMm / expectedDimensions.heightMm; // ~1.585

      const deviation = Math.abs(
        (detectedAspectRatio - expectedAspectRatio) / expectedAspectRatio
      );

      expect(deviation).toBeGreaterThan(0.5); // Should fail validation
    });
  });

  describe('Edge Cases', () => {
    it('handles very small detected marker', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: {
          x: 400,
          y: 400,
          widthPx: 5, // Very small!
          heightPx: 5,
        },
        confidence: createDetectionConfidence(0.3),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      // Math still works, but the detection should fail validation
      // (too small, too low confidence)
      expect(calibration.pixelsPerMmX).toBeDefined();
      expect(calibration.pixelsPerMmX).toBeGreaterThan(0);
    });

    it('handles marker at high magnification (many pixels)', () => {
      // Very close to camera, high magnification
      const detection: MarkerDetectionResult = {
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: {
          x: 0,
          y: 0,
          widthPx: 2400, // ~100 pixels per mm
          heightPx: 2400,
        },
        confidence: createDetectionConfidence(0.95),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      expect(calibration.pixelsPerMmX).toBeCloseTo(2400 / 24.26, 0);
      expect(calibration.pixelsPerMmY).toBeCloseTo(2400 / 24.26, 0);
    });

    it('handles marker at low magnification (few pixels)', () => {
      // Very far from camera, low magnification
      const detection: MarkerDetectionResult = {
        markerType: 'ruler',
        dimensions: REFERENCE_MARKER_SPECS.ruler,
        pixelBounds: {
          x: 200,
          y: 100,
          widthPx: 30, // Very small in image
          heightPx: 3,
        },
        confidence: createDetectionConfidence(0.5),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      // Ruler is 300mm × 30mm
      const pixelsPerMmX = 30 / 300; // 0.1 px/mm
      const pixelsPerMmY = 3 / 30; // 0.1 px/mm

      expect(calibration.pixelsPerMmX).toBeCloseTo(pixelsPerMmX, 2);
      expect(calibration.pixelsPerMmY).toBeCloseTo(pixelsPerMmY, 2);
    });

    it('handles zero-confidence detection', () => {
      const detection: MarkerDetectionResult = {
        markerType: 'credit_card',
        dimensions: REFERENCE_MARKER_SPECS.credit_card,
        pixelBounds: {
          x: 100,
          y: 100,
          widthPx: 856,
          heightPx: 540,
        },
        confidence: createDetectionConfidence(0),
        detectedAt: new Date().toISOString(),
      };

      const calibration = computeImagePlaneCalibration(detection);

      // Math still computes, but validation should reject it
      expect(calibration.pixelsPerMmX).toBeGreaterThan(0);
    });
  });

  describe('Food Measurement Examples', () => {
    it('measures food width using calibrated scale', () => {
      // User places a US quarter (24.26mm) as reference
      // Quarter appears as 243 pixels → ~10 pixels per mm
      const quarterCalibration = computeImagePlaneCalibration({
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: { x: 100, y: 100, widthPx: 243, heightPx: 243 },
        confidence: createDetectionConfidence(0.9),
        detectedAt: new Date().toISOString(),
      });

      // Food item measures 300 pixels wide
      const foodWidthPx = 300;
      const foodWidthMm = foodWidthPx / quarterCalibration.pixelsPerMmX;

      // Expected: ~30 mm (reasonable for a sandwich cross-section)
      expect(foodWidthMm).toBeCloseTo(30, 0);
    });

    it('does NOT compute volume from 2D scale', () => {
      // This is a test that volume is NOT computed
      // Even with perfect calibration, we cannot infer volume from a single image
      const calibration = computeImagePlaneCalibration({
        markerType: 'us_quarter',
        dimensions: REFERENCE_MARKER_SPECS.us_quarter,
        pixelBounds: { x: 100, y: 100, widthPx: 243, heightPx: 243 },
        confidence: createDetectionConfidence(0.95),
        detectedAt: new Date().toISOString(),
      });

      // We know food is 30mm wide and 20mm tall in the image
      // But we do NOT know its depth!
      // Height could be: 10mm, 50mm, or 200mm — we can't tell from one angle

      expect(calibration.disclaimer).toContain('No volume estimation');
    });

    it('does NOT compute mass from pixel measurements', () => {
      // Even if we estimated volume, we couldn't compute mass without density
      // And density varies: a cake cube vs a cheese cube of same size have different mass

      const calibration = computeImagePlaneCalibration({
        markerType: 'credit_card',
        dimensions: REFERENCE_MARKER_SPECS.credit_card,
        pixelBounds: { x: 50, y: 60, widthPx: 856, heightPx: 540 },
        confidence: createDetectionConfidence(0.9),
        detectedAt: new Date().toISOString(),
      });

      expect(calibration.disclaimer).toContain('no mass inference');
    });
  });
});
