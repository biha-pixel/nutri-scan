/**
 * Reference Marker Detection Service
 *
 * PLACEHOLDER IMPLEMENTATION
 *
 * This service provides the interface for detecting and validating reference markers
 * in food photographs. The actual marker detection is NOT YET IMPLEMENTED — this file
 * provides the structure and type definitions so the UI can be built now, and the
 * detector can be added later without changing the rest of the codebase.
 *
 * FUTURE IMPLEMENTATION:
 * When marker detection is implemented, replace the stub functions below with:
 * - OpenCV-based shape detection (rectangles for cards, circles for coins)
 * - Template matching for known markers
 * - ML-based marker classification (if a trained model is available)
 *
 * DEPENDENCIES:
 * - expo-image-manipulator (available): for basic image operations
 * - No heavy ML libraries currently added (to keep bundle size low)
 * - Future: expo-camera plugin might provide native APIs
 */

import type {
  MarkerDetectionResult,
  MarkerPixelBounds,
  ReferenceMarkerType,
  ReferenceMarkerDimensions,
  IMarkerDetectionService,
} from '@/types/reference-marker';
import { REFERENCE_MARKER_SPECS, createDetectionConfidence } from '@/types/reference-marker';

/**
 * Minimum pixel size for a valid detection.
 * Markers smaller than this are too small to be reliably detected or used.
 */
const MIN_MARKER_WIDTH_PX = 20;
const MIN_MARKER_HEIGHT_PX = 20;

/**
 * Minimum confidence threshold for a detection to be used.
 * Detections below this are treated as failures.
 */
const MIN_DETECTION_CONFIDENCE = 0.5;

/**
 * Maximum allowed aspect ratio deviation for marker validation.
 * If detected aspect ratio differs significantly from expected, validation fails.
 * Example: credit card is 85.6 × 53.98 mm (ratio ~1.585)
 */
const MAX_ASPECT_RATIO_DEVIATION = 0.15; // ±15% tolerance

/**
 * Stub implementation of the marker detection service.
 * Currently returns null (no detection). When marker detection is implemented,
 * replace the detection logic while keeping the interface unchanged.
 */
class MarkerDetectionService implements IMarkerDetectionService {
  /**
   * Detect a reference marker in an image.
   *
   * CURRENT STATUS: PLACEHOLDER — Always returns null (no marker detected)
   *
   * FUTURE IMPLEMENTATION:
   * This function should:
   * 1. Load the image from imageUri (or decode base64)
   * 2. Apply edge detection and contour finding (OpenCV-style)
   * 3. Identify circular or rectangular shapes
   * 4. Match detected shapes against known marker dimensions
   * 5. Return MarkerDetectionResult if marker found and confidence > threshold
   *
   * Example pseudo-code:
   * ```
   * const image = await loadImage(imageUri);
   * const gray = toGrayscale(image);
   * const edges = cannyEdgeDetection(gray);
   * const contours = findContours(edges);
   *
   * for (const contour of contours) {
   *   const shape = analyzeShape(contour);  // circular? rectangular?
   *   const dimensions = estimateDimensions(contour, image.dpi);
   *   const markerType = matchMarkerType(shape, dimensions);
   *
   *   if (markerType && confidence > 0.5) {
   *     return { markerType, dimensions, pixelBounds, confidence, detectedAt };
   *   }
   * }
   * return null;  // No marker found
   * ```
   *
   * @param imageUri — Local file URI or base64-encoded image
   * @param expectedMarkerType — Optional hint (e.g., 'credit_card')
   * @returns Detection result or null if not found
   */
  async detectMarker(
    imageUri: string,
    expectedMarkerType?: ReferenceMarkerType
  ): Promise<MarkerDetectionResult | null> {
    // PLACEHOLDER: Always return null
    // In a real implementation, this would:
    // 1. Load and process the image
    // 2. Detect shapes matching known markers
    // 3. Return detection result if found

    console.warn(
      '[MarkerDetectionService] detectMarker() is not yet implemented. ' +
        'Marker detection will return null. This is a placeholder interface.'
    );

    return null;
  }

  /**
   * Validate a detection result before using it for calibration.
   *
   * Checks:
   * - Marker is large enough (> MIN_MARKER_WIDTH_PX, > MIN_MARKER_HEIGHT_PX)
   * - Confidence score is sufficient (>= MIN_DETECTION_CONFIDENCE)
   * - Pixel bounds are within image dimensions
   * - Aspect ratio matches expected marker shape (±15% tolerance)
   *
   * @param detection — Detection result to validate
   * @param imageWidthPx — Image width in pixels
   * @param imageHeightPx — Image height in pixels
   * @returns True if valid, false otherwise
   */
  validateDetection(
    detection: MarkerDetectionResult,
    imageWidthPx: number,
    imageHeightPx: number
  ): boolean {
    const { pixelBounds, confidence, dimensions } = detection;

    // Check 1: Marker is large enough
    if (pixelBounds.widthPx < MIN_MARKER_WIDTH_PX || pixelBounds.heightPx < MIN_MARKER_HEIGHT_PX) {
      console.warn(
        `[MarkerDetectionService] Marker too small: ${pixelBounds.widthPx}×${pixelBounds.heightPx}px`
      );
      return false;
    }

    // Check 2: Confidence is sufficient
    if (confidence < MIN_DETECTION_CONFIDENCE) {
      console.warn(
        `[MarkerDetectionService] Confidence too low: ${confidence.toFixed(2)} < ${MIN_DETECTION_CONFIDENCE}`
      );
      return false;
    }

    // Check 3: Pixel bounds are within image
    if (
      pixelBounds.x < 0 ||
      pixelBounds.y < 0 ||
      pixelBounds.x + pixelBounds.widthPx > imageWidthPx ||
      pixelBounds.y + pixelBounds.heightPx > imageHeightPx
    ) {
      console.warn('[MarkerDetectionService] Marker bounds exceed image dimensions');
      return false;
    }

    // Check 4: Aspect ratio matches expected marker
    // Expected aspect ratio from known dimensions
    const expectedAspectRatio = dimensions.widthMm / dimensions.heightMm;
    // Detected aspect ratio from pixel bounds
    const detectedAspectRatio = pixelBounds.widthPx / pixelBounds.heightPx;
    // Relative deviation
    const aspectRatioDeviation = Math.abs(
      (detectedAspectRatio - expectedAspectRatio) / expectedAspectRatio
    );

    if (aspectRatioDeviation > MAX_ASPECT_RATIO_DEVIATION) {
      console.warn(
        `[MarkerDetectionService] Aspect ratio mismatch: detected ${detectedAspectRatio.toFixed(2)}, ` +
          `expected ~${expectedAspectRatio.toFixed(2)} (deviation: ${(aspectRatioDeviation * 100).toFixed(1)}%)`
      );
      return false;
    }

    // All checks passed
    return true;
  }
}

/**
 * Singleton instance of the marker detection service.
 * Can be replaced in tests with a mock implementation.
 */
let markerDetectionServiceInstance: IMarkerDetectionService | null = null;

/**
 * Get the marker detection service instance.
 */
export function getMarkerDetectionService(): IMarkerDetectionService {
  if (!markerDetectionServiceInstance) {
    markerDetectionServiceInstance = new MarkerDetectionService();
  }
  return markerDetectionServiceInstance;
}

/**
 * Set a custom marker detection service (for testing).
 */
export function setMarkerDetectionService(service: IMarkerDetectionService): void {
  markerDetectionServiceInstance = service;
}

/**
 * Reset to the default marker detection service (for testing).
 */
export function resetMarkerDetectionService(): void {
  markerDetectionServiceInstance = null;
}
