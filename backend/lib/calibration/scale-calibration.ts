/**
 * 2D Scale Calibration Service
 *
 * Converts detected reference marker bounding boxes (in pixels) into
 * image-plane calibration factors (pixelsPerMm).
 *
 * CRITICAL: This service computes pixel-to-mm conversion ONLY for the image plane.
 * It does NOT provide depth, does NOT estimate food volume or height,
 * and does NOT infer food mass.
 */

import type { CaptureMetadata } from '@/lib/validation/schemas';
import type { FoodRecognitionResult, DetectedMarker } from '@/lib/food/types';
import { REFERENCE_MARKER_SPECS } from '@/lib/calibration/reference-markers';
import type { ReferenceMarkerType } from '@/lib/calibration/reference-markers';

/**
 * Physical dimensions of a reference marker in millimeters.
 * Matches REFERENCE_MARKER_SPECS format.
 */
interface MarkerDimensions {
  widthMm: number;
  heightMm: number;
  shape: 'rectangular' | 'circular';
}

/**
 * A 2D bounding box normalized to 0–1000 scale [ymin, xmin, ymax, xmax].
 * Used by Gemini response for marker detection and food item bounding boxes.
 */
type Box2D = [ymin: number, xmin: number, ymax: number, xmax: number];

/**
 * Pixel bounds of a detected marker in the image.
 * Computed from normalized box2d and image dimensions.
 */
interface PixelBounds {
  yMin: number;
  xMin: number;
  yMax: number;
  xMax: number;
  widthPx: number;
  heightPx: number;
}

/**
 * Result of 2D scale calibration computation.
 * Contains both the calibration factors and validation metadata.
 */
export interface CalibrationSummary {
  /** Whether calibration succeeded */
  success: boolean;

  /** Pixels per millimeter horizontally (if success = true) */
  pixelsPerMmX?: number;

  /** Pixels per millimeter vertically (if success = true) */
  pixelsPerMmY?: number;

  /** Aspect ratio (pixelsPerMmX / pixelsPerMmY). Close to 1.0 = square pixels. */
  aspectRatio?: number;

  /** Detected marker type (if success = true) */
  markerType?: ReferenceMarkerType;

  /** Detected marker confidence (0.0 to 1.0) */
  confidence?: number;

  /** Validation status describing the outcome */
  validationStatus:
    | 'success'
    | 'no_marker_detected'
    | 'low_confidence'
    | 'marker_too_small'
    | 'invalid_aspect_ratio'
    | 'custom_dimensions_invalid'
    | 'invalid_box2d';

  /** Human-readable message describing the result or failure reason */
  message: string;

  /** Minimum confidence threshold used for validation */
  minConfidenceThreshold: number;

  /** Minimum marker size in pixels */
  minMarkerSizePx: number;

  /** Allowed aspect ratio deviation (±percentage) */
  aspectRatioTolerancePercent: number;
}

/**
 * Constants for calibration validation.
 */
const CALIBRATION_CONFIG = {
  /** Minimum confidence score to accept a detection */
  MIN_CONFIDENCE: 0.5,

  /** Minimum marker size in pixels (too small = unreliable) */
  MIN_MARKER_SIZE_PX: 20,

  /** Allowed aspect ratio deviation (±20%) */
  ASPECT_RATIO_TOLERANCE_PERCENT: 20,
};

/**
 * Convert a normalized box2d [ymin, xmin, ymax, xmax] (0–1000 scale)
 * to pixel bounds given image dimensions.
 *
 * @param box2d Normalized bounding box
 * @param imageWidthPx Image width in pixels
 * @param imageHeightPx Image height in pixels
 * @returns Pixel bounds or error message
 */
function normalizedBox2dToPixels(
  box2d: Box2D,
  imageWidthPx: number,
  imageHeightPx: number
): PixelBounds | string {
  if (
    !Array.isArray(box2d) ||
    box2d.length !== 4 ||
    box2d.some((v) => typeof v !== 'number' || v < 0 || v > 1000)
  ) {
    return 'Invalid box2d: must be [ymin, xmin, ymax, xmax] with values 0–1000';
  }

  const [ymin, xmin, ymax, xmax] = box2d;

  // Convert from 0–1000 scale to pixels
  const yMinPx = Math.round((ymin / 1000) * imageHeightPx);
  const xMinPx = Math.round((xmin / 1000) * imageWidthPx);
  const yMaxPx = Math.round((ymax / 1000) * imageHeightPx);
  const xMaxPx = Math.round((xmax / 1000) * imageWidthPx);

  // Compute width and height
  const widthPx = xMaxPx - xMinPx;
  const heightPx = yMaxPx - yMinPx;

  if (widthPx <= 0 || heightPx <= 0) {
    return 'Invalid box2d: computed pixel dimensions must be positive';
  }

  return { yMin: yMinPx, xMin: xMinPx, yMax: yMaxPx, xMax: xMaxPx, widthPx, heightPx };
}

/**
 * Get physical dimensions for a marker type.
 * For custom markers, returns provided dimensions or error.
 *
 * @param markerType Marker type
 * @param customDimensionsMm Optional custom dimensions for 'custom' marker type
 * @returns Marker dimensions or error message
 */
function getMarkerDimensions(
  markerType: ReferenceMarkerType,
  customDimensionsMm?: { widthMm: number; heightMm: number }
): MarkerDimensions | string {
  if (markerType === 'custom') {
    if (
      !customDimensionsMm ||
      typeof customDimensionsMm.widthMm !== 'number' ||
      typeof customDimensionsMm.heightMm !== 'number' ||
      customDimensionsMm.widthMm <= 0 ||
      customDimensionsMm.heightMm <= 0
    ) {
      return 'Custom marker selected but customDimensionsMm missing or invalid';
    }
    return {
      widthMm: customDimensionsMm.widthMm,
      heightMm: customDimensionsMm.heightMm,
      shape: 'rectangular',
    };
  }

  const spec = REFERENCE_MARKER_SPECS[markerType];
  if (!spec) {
    return `Unknown marker type: ${markerType}`;
  }

  return {
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
    shape: spec.shape,
  };
}

/**
 * Validate aspect ratio of detected marker against expected dimensions.
 * For rectangular markers, checks that detected aspect ratio matches physical aspect ratio.
 * For circular markers, checks that detected width ≈ height (within tolerance).
 *
 * @param detectedWidthPx Detected width in pixels
 * @param detectedHeightPx Detected height in pixels
 * @param markerDimensions Physical dimensions (mm)
 * @param tolerance Allowed deviation in percentage
 * @returns True if valid, false otherwise
 */
function validateAspectRatio(
  detectedWidthPx: number,
  detectedHeightPx: number,
  markerDimensions: MarkerDimensions,
  tolerance: number
): boolean {
  const expectedAspectRatio = markerDimensions.widthMm / markerDimensions.heightMm;
  const detectedAspectRatio = detectedWidthPx / detectedHeightPx;

  // Compute percentage difference
  const percentDiff = Math.abs((detectedAspectRatio - expectedAspectRatio) / expectedAspectRatio) * 100;

  return percentDiff <= tolerance;
}

/**
 * Compute image-plane calibration from a detected and validated marker.
 *
 * @param detectedMarker Detected marker from vision provider
 * @param imageWidthPx Image width in pixels
 * @param imageHeightPx Image height in pixels
 * @param calibrationContext Capture metadata (includes custom dimensions if needed)
 * @returns Calibration summary with results or error details
 */
function computeCalibrationFromMarker(
  detectedMarker: DetectedMarker,
  imageWidthPx: number,
  imageHeightPx: number,
  customDimensionsMm?: { widthMm: number; heightMm: number }
): CalibrationSummary {
  // Step 1: Validate confidence
  if (detectedMarker.confidence < CALIBRATION_CONFIG.MIN_CONFIDENCE) {
    return {
      success: false,
      validationStatus: 'low_confidence',
      message: `Marker confidence ${detectedMarker.confidence.toFixed(2)} below threshold ${CALIBRATION_CONFIG.MIN_CONFIDENCE}`,
      minConfidenceThreshold: CALIBRATION_CONFIG.MIN_CONFIDENCE,
      minMarkerSizePx: CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX,
      aspectRatioTolerancePercent: CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT,
    };
  }

  // Step 2: Convert box2d to pixel bounds
  // Validate that box2d is defined
  if (!detectedMarker.box2d) {
    return {
      success: false,
      validationStatus: 'invalid_box2d',
      message: 'Marker box2d is missing',
      minConfidenceThreshold: CALIBRATION_CONFIG.MIN_CONFIDENCE,
      minMarkerSizePx: CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX,
      aspectRatioTolerancePercent: CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT,
    };
  }

  const pixelBoundsOrError = normalizedBox2dToPixels(
    detectedMarker.box2d as Box2D,
    imageWidthPx,
    imageHeightPx
  );
  if (typeof pixelBoundsOrError === 'string') {
    return {
      success: false,
      validationStatus: 'invalid_box2d',
      message: pixelBoundsOrError,
      minConfidenceThreshold: CALIBRATION_CONFIG.MIN_CONFIDENCE,
      minMarkerSizePx: CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX,
      aspectRatioTolerancePercent: CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT,
    };
  }
  const pixelBounds = pixelBoundsOrError;

  // Step 3: Validate marker size
  const minDim = Math.min(pixelBounds.widthPx, pixelBounds.heightPx);
  if (minDim < CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX) {
    return {
      success: false,
      validationStatus: 'marker_too_small',
      message: `Marker size ${minDim}px below minimum ${CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX}px`,
      minConfidenceThreshold: CALIBRATION_CONFIG.MIN_CONFIDENCE,
      minMarkerSizePx: CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX,
      aspectRatioTolerancePercent: CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT,
    };
  }

  // Step 4: Get physical dimensions
  const markerDimensionsOrError = getMarkerDimensions(
    detectedMarker.markerType as ReferenceMarkerType,
    customDimensionsMm
  );
  if (typeof markerDimensionsOrError === 'string') {
    return {
      success: false,
      validationStatus: detectedMarker.markerType === 'custom'
        ? 'custom_dimensions_invalid'
        : 'invalid_box2d',
      message: markerDimensionsOrError,
      minConfidenceThreshold: CALIBRATION_CONFIG.MIN_CONFIDENCE,
      minMarkerSizePx: CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX,
      aspectRatioTolerancePercent: CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT,
    };
  }
  const markerDimensions = markerDimensionsOrError;

  // Step 5: Validate aspect ratio
  if (
    !validateAspectRatio(
      pixelBounds.widthPx,
      pixelBounds.heightPx,
      markerDimensions,
      CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT
    )
  ) {
    const expectedRatio = (markerDimensions.widthMm / markerDimensions.heightMm).toFixed(2);
    const detectedRatio = (pixelBounds.widthPx / pixelBounds.heightPx).toFixed(2);
    return {
      success: false,
      validationStatus: 'invalid_aspect_ratio',
      message: `Aspect ratio mismatch: detected ${detectedRatio}, expected ${expectedRatio}`,
      minConfidenceThreshold: CALIBRATION_CONFIG.MIN_CONFIDENCE,
      minMarkerSizePx: CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX,
      aspectRatioTolerancePercent: CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT,
    };
  }

  // Step 6: Compute calibration
  const pixelsPerMmX = pixelBounds.widthPx / markerDimensions.widthMm;
  const pixelsPerMmY = pixelBounds.heightPx / markerDimensions.heightMm;
  const aspectRatio = pixelsPerMmX / pixelsPerMmY;

  return {
    success: true,
    pixelsPerMmX,
    pixelsPerMmY,
    aspectRatio,
    markerType: detectedMarker.markerType as ReferenceMarkerType,
    confidence: detectedMarker.confidence,
    validationStatus: 'success',
    message: `Calibration successful: ${pixelsPerMmX.toFixed(3)} px/mm (X), ${pixelsPerMmY.toFixed(3)} px/mm (Y)`,
    minConfidenceThreshold: CALIBRATION_CONFIG.MIN_CONFIDENCE,
    minMarkerSizePx: CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX,
    aspectRatioTolerancePercent: CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT,
  };
}

/**
 * Attempt 2D scale calibration from detected markers in a food analysis result.
 *
 * This function:
 * 1. Checks if calibration is enabled in the capture metadata
 * 2. Looks for a detected marker in the food analysis result
 * 3. Validates marker confidence and size
 * 4. Computes pixelsPerMm values if validation passes
 *
 * If calibration is disabled, skipped, or fails validation, returns a summary
 * with validationStatus indicating why.
 *
 * @param result Food analysis result (may contain detectedMarker)
 * @param calibrationContext Capture metadata (determines if calibration was enabled)
 * @returns Calibration summary with results or reason for skipping/failure
 */
export function attemptScaleCalibration(
  result: FoodRecognitionResult,
  calibrationContext: CaptureMetadata | null | undefined
): CalibrationSummary {
  // Check if calibration was enabled
  if (!calibrationContext?.referenceCalibration.enabled) {
    return {
      success: false,
      validationStatus: 'no_marker_detected',
      message: 'Calibration disabled or not provided in capture metadata',
      minConfidenceThreshold: CALIBRATION_CONFIG.MIN_CONFIDENCE,
      minMarkerSizePx: CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX,
      aspectRatioTolerancePercent: CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT,
    };
  }

  // Check if marker was detected
  if (!result.detectedMarker) {
    return {
      success: false,
      validationStatus: 'no_marker_detected',
      message: 'No reference marker detected in image',
      minConfidenceThreshold: CALIBRATION_CONFIG.MIN_CONFIDENCE,
      minMarkerSizePx: CALIBRATION_CONFIG.MIN_MARKER_SIZE_PX,
      aspectRatioTolerancePercent: CALIBRATION_CONFIG.ASPECT_RATIO_TOLERANCE_PERCENT,
    };
  }

  // Extract custom dimensions from calibration context if marker type is 'custom'
  const customDimensions =
    result.detectedMarker.markerType === 'custom'
      ? (calibrationContext.referenceCalibration as any).customDimensionsMm
      : undefined;

  // Compute calibration
  return computeCalibrationFromMarker(
    result.detectedMarker,
    calibrationContext.imageWidthPx,
    calibrationContext.imageHeightPx,
    customDimensions
  );
}

/**
 * Attach calibration summary to a food analysis result.
 * Used by the route handler to include calibration in the API response.
 *
 * @param result Food analysis result
 * @param calibrationSummary Computed calibration summary
 * @returns Result with calibration summary added
 */
export function attachCalibrationToResult(
  result: FoodRecognitionResult,
  calibrationSummary: CalibrationSummary
): FoodRecognitionResult & { calibration: CalibrationSummary } {
  return {
    ...result,
    calibration: calibrationSummary,
  };
}
