/**
 * Reference Marker Types
 *
 * Defines versioned specifications for optional reference objects used to calibrate
 * image-plane scale during food photography. A reference marker is a physical object
 * with known dimensions (e.g., a credit card, coin, or ruler) placed in the scene.
 *
 * IMPORTANT DESIGN PRINCIPLES:
 * 1. A reference marker is OPTIONAL — users can capture food without it.
 * 2. The marker's pixel size is NOT assumed known until detected and validated.
 * 3. Pixel-to-millimeter conversion is done ONLY after detection, never assumed.
 * 4. This service does NOT infer food volume, height, or mass from scale alone.
 * 5. Marker detection is currently a placeholder interface — not implemented.
 * 6. Future detection can be added without changing these type definitions.
 */

/**
 * Known reference marker types with standard physical dimensions.
 * Each marker has a canonical size and recognizable visual features.
 */
export type ReferenceMarkerType =
  | 'credit_card'      // Standard credit card: 85.6 × 53.98 mm
  | 'us_quarter'       // US quarter: 24.26 mm diameter
  | 'us_penny'         // US penny: 19.05 mm diameter
  | 'one_euro_coin'    // €1 coin: 23.25 mm diameter
  | 'ruler'            // Generic ruler with printed millimeters
  | 'custom';          // User-provided custom dimensions

/**
 * Physical dimensions of a reference marker in millimeters.
 * These are the real-world measurements, not pixels.
 */
export interface ReferenceMarkerDimensions {
  /** Width in millimeters */
  widthMm: number;
  /** Height in millimeters (for rectangular markers) or diameter (for circular) */
  heightMm: number;
  /** Marker shape for detection and validation purposes */
  shape: 'rectangular' | 'circular';
  /** ISO 4217 country code if currency-based, e.g. 'US', 'EU' */
  country?: string;
}

/**
 * Standard reference marker specifications with known, verified dimensions.
 */
export const REFERENCE_MARKER_SPECS: Record<
  Exclude<ReferenceMarkerType, 'custom'>,
  ReferenceMarkerDimensions
> = {
  credit_card: {
    widthMm: 85.6,
    heightMm: 53.98,
    shape: 'rectangular',
    country: 'ISO',
  },
  us_quarter: {
    widthMm: 24.26,
    heightMm: 24.26,
    shape: 'circular',
    country: 'US',
  },
  us_penny: {
    widthMm: 19.05,
    heightMm: 19.05,
    shape: 'circular',
    country: 'US',
  },
  one_euro_coin: {
    widthMm: 23.25,
    heightMm: 23.25,
    shape: 'circular',
    country: 'EU',
  },
  ruler: {
    widthMm: 300, // Standard 12-inch ruler in millimeters
    heightMm: 30,
    shape: 'rectangular',
  },
};

/**
 * Pixel bounds of a detected reference marker in the image.
 * These are the raw detection results before validation.
 */
export interface MarkerPixelBounds {
  /** Left edge in pixels (x-axis) */
  x: number;
  /** Top edge in pixels (y-axis) */
  y: number;
  /** Width in pixels */
  widthPx: number;
  /** Height in pixels */
  heightPx: number;
}

/**
 * Confidence score for marker detection (0.0 to 1.0).
 * Lower scores indicate ambiguity; validation may reject low-confidence detections.
 */
export type DetectionConfidence = number & { readonly __brand: 'DetectionConfidence' };

export function createDetectionConfidence(value: number): DetectionConfidence {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped as DetectionConfidence;
}

/**
 * Result of detecting a reference marker in an image.
 * This is the raw detection output before calibration math.
 */
export interface MarkerDetectionResult {
  /** Type of marker detected */
  markerType: ReferenceMarkerType;
  /** Physical dimensions of the marker (mm) */
  dimensions: ReferenceMarkerDimensions;
  /** Pixel bounds of the detected marker in the image */
  pixelBounds: MarkerPixelBounds;
  /** Confidence score (0.0 to 1.0) */
  confidence: DetectionConfidence;
  /** Detection timestamp (ISO 8601) */
  detectedAt: string;
}

/**
 * Calibration result: pixel-to-millimeter conversion factors.
 * Computed ONLY after marker detection is validated.
 * These factors allow converting pixel measurements to millimeters in the image plane.
 */
export interface ImagePlaneCalibration {
  /** Pixels per millimeter horizontally */
  pixelsPerMmX: number;
  /** Pixels per millimeter vertically */
  pixelsPerMmY: number;
  /** Aspect ratio of the conversion (X / Y). Close to 1.0 means square pixels. */
  aspectRatio: number;
  /**
   * CRITICAL DISCLAIMER:
   * This calibration converts pixels to distance IN THE IMAGE PLANE ONLY.
   * It does NOT provide depth, does NOT estimate food volume or height,
   * and does NOT infer food mass. These factors alone cannot determine
   * three-dimensional properties of food.
   */
  disclaimer:
    | 'Image-plane scale only. No depth, no volume estimation, no mass inference.'
    | 'Pixel-to-mm conversion for 2D measurements only. Food is three-dimensional.';
}

/**
 * V1 of reference marker calibration metadata.
 * Recorded when marker detection succeeds and calibration is computed.
 */
export interface ReferenceMarkerCalibrationV1 {
  /** Schema version — always "1" for this interface */
  version: 1;

  /** Whether calibration was attempted or opted-out */
  calibrationEnabled: boolean;

  /** Marker detection result (if calibration was attempted) */
  detection?: MarkerDetectionResult;

  /** Computed calibration (if detection succeeded and was validated) */
  calibration?: ImagePlaneCalibration;

  /** Detection validation status */
  validationStatus:
    | 'not_attempted'  // User skipped calibration
    | 'pending'        // Detection in progress
    | 'detected'       // Marker detected but not yet validated
    | 'validated'      // Detection passed validation checks
    | 'validation_failed'  // Detection failed validation (e.g., too small, occluded)
    | 'detection_failed';   // No marker detected in image

  /** User-friendly status message for display */
  statusMessage: string;
}

/**
 * Type union for versioned reference marker calibration.
 * Currently only V1 is defined. Future versions allow schema evolution.
 */
export type ReferenceMarkerCalibration = ReferenceMarkerCalibrationV1;

/**
 * Type guard for reference marker calibration version.
 */
export function referenceMarkerCalibrationVersion(
  calibration: ReferenceMarkerCalibration
): calibration is ReferenceMarkerCalibrationV1 {
  return calibration.version === 1;
}

/**
 * Interface for a marker detection service.
 * This is a placeholder for future implementation of actual marker detection.
 * Currently returns null (no detection). When implemented, will use image
 * processing to locate and identify markers in the image.
 */
export interface IMarkerDetectionService {
  /**
   * Detect a reference marker in an image and return its bounds and type.
   *
   * @param imageUri — Local file URI or base64-encoded image data
   * @param expectedMarkerType — Optional hint about which marker to look for
   * @returns Detection result if marker found, null if no marker detected
   * @throws Error if detection fails for technical reasons
   *
   * IMPLEMENTATION NOTES:
   * - Current implementation: returns null (placeholder)
   * - Future implementation: use image processing library or ML model
   * - Should validate detected size is reasonable (e.g., > 10 pixels)
   * - Should reject detections with confidence < 0.5
   */
  detectMarker(
    imageUri: string,
    expectedMarkerType?: ReferenceMarkerType
  ): Promise<MarkerDetectionResult | null>;

  /**
   * Validate a detection result before using it for calibration.
   *
   * Checks:
   * - Marker is large enough to be reliably detected (> 20 pixels)
   * - Confidence score is sufficient (>= 0.5)
   * - Pixel bounds are within reasonable image dimensions
   * - Aspect ratio matches expected marker shape
   *
   * @param detection — Detection result to validate
   * @param imageWidthPx — Width of the image in pixels (for bounds check)
   * @param imageHeightPx — Height of the image in pixels (for bounds check)
   * @returns True if detection is valid, false otherwise
   */
  validateDetection(
    detection: MarkerDetectionResult,
    imageWidthPx: number,
    imageHeightPx: number
  ): boolean;
}

/**
 * Helper to compute calibration from a validated detection result.
 * Called ONLY after marker detection has been validated.
 *
 * @param detection — Validated marker detection result
 * @returns Image plane calibration (pixels per mm)
 */
export function computeImagePlaneCalibration(
  detection: MarkerDetectionResult
): ImagePlaneCalibration {
  const { pixelBounds, dimensions } = detection;

  // Compute pixels-per-mm for each axis
  const pixelsPerMmX = pixelBounds.widthPx / dimensions.widthMm;
  const pixelsPerMmY = pixelBounds.heightPx / dimensions.heightMm;

  // Aspect ratio: how different are X and Y scales?
  // Close to 1.0 = square pixels. Values far from 1.0 suggest distortion.
  const aspectRatio = pixelsPerMmX / pixelsPerMmY;

  return {
    pixelsPerMmX,
    pixelsPerMmY,
    aspectRatio,
    disclaimer: 'Image-plane scale only. No depth, no volume estimation, no mass inference.',
  };
}

/**
 * Helper to create a placeholder calibration metadata object.
 * Used when calibration is skipped or not attempted.
 */
export function createPlaceholderCalibration(
  calibrationEnabled: boolean,
  statusMessage: string
): ReferenceMarkerCalibrationV1 {
  return {
    version: 1,
    calibrationEnabled,
    validationStatus: calibrationEnabled ? 'pending' : 'not_attempted',
    statusMessage,
  };
}
