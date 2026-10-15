/**
 * Food Capture Metadata Types
 *
 * Versioned schema for recording measured and user-selected data about a food photograph.
 * This metadata is not used for measurement claims or depth perception — it is purely
 * informational about the capture session and image properties.
 *
 * DESIGN PRINCIPLES:
 * 1. Record only what can be reliably measured or verified.
 * 2. Distinguish measured sensor values from user settings from estimated values (future).
 * 3. Do NOT include GPS, device identifiers, or unrelated EXIF data.
 * 4. Do NOT claim a single RGB image provides true depth or absolute physical dimensions.
 * 5. Keep optional fields for data that may not be available on all devices/platforms.
 * 6. Versioning allows future schema evolution without breaking existing captures.
 */

import type { ReferenceMarkerType } from './reference-marker';

/**
 * The capture mode determines how the image was acquired.
 * Distinguishes deliberate camera captures from gallery selections.
 */
export type CaptureMode = 'camera' | 'gallery';

/**
 * Inferred MIME type of the image file.
 * Determined by file extension or content header inspection, not by user input.
 */
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/unknown';

/**
 * Image orientation relative to the device's natural orientation.
 * Optional because not all platforms/sources provide this reliably.
 *
 * Values follow the EXIF orientation tag convention:
 * - 'portrait' — 0° or 180° (normal or upside-down)
 * - 'landscape-left' — 90° (rotated left, camera on right)
 * - 'landscape-right' — 270° (rotated right, camera on left)
 */
export type ImageOrientation = 'portrait' | 'landscape-left' | 'landscape-right';

/**
 * Reference calibration configuration collected during food capture.
 * Records the user's choice to enable/disable calibration and their marker selection.
 * This is PRE-CAPTURE configuration, distinct from post-capture detection results.
 */
export interface ReferenceCalibrationConfigV1 {
  /** Schema version — always 1 for this interface */
  version: 1;

  /** Whether the user enabled reference calibration for this capture */
  enabled: boolean;

  /** Selected reference marker type (only populated if enabled = true) */
  selectedMarkerType?: ReferenceMarkerType;

  /** Custom marker dimensions in millimeters (only if selectedMarkerType = 'custom' and enabled = true) */
  customDimensionsMm?: { widthMm: number; heightMm: number };

  /** User-friendly status message describing the calibration selection */
  statusMessage: string;
}

/**
 * Reference calibration — discriminated union supporting both enabled and disabled states.
 * Backward compatible: `{ enabled: false }` represents no calibration (gallery uploads, existing flows).
 * When enabled = true, includes marker selection and optional custom dimensions.
 */
export type ReferenceCalibration =
  | ReferenceCalibrationConfigV1
  | { enabled: false };

/**
 * V1 of food capture metadata (current implementation).
 * Records the minimal set of data available from a real capture or gallery selection.
 */
export interface FoodCaptureMetadataV1 {
  /** Schema version — always "1" for this interface */
  version: 1;

  /** ─── Capture Session ─── */

  /** When the image was captured (ISO 8601 timestamp, UTC) */
  capturedAt: string;

  /** How the image was acquired ('camera' or 'gallery') */
  captureMode: CaptureMode;

  /** ─── Image Dimensions (Measured) ─── */

  /** Pixel width of the image as stored (sensor output or file metadata) */
  imageWidthPx: number;

  /** Pixel height of the image as stored (sensor output or file metadata) */
  imageHeightPx: number;

  /** ─── Image Properties (Measured) ─── */

  /** Inferred MIME type of the image file (determined by header or extension) */
  mimeType: ImageMimeType;

  /** Estimated size of the image file in bytes (for upload diagnostics) */
  estimatedFileSizeBytesApprox?: number;

  /** ─── Image Orientation (Optional, Measured) ─── */

  /** Image orientation if available (portrait, landscape-left, landscape-right) */
  orientation?: ImageOrientation;

  /** ─── Capture Settings (User-Selected or Sensor-Provided) ─── */

  /** JPEG/WebP quality used (0.0 to 1.0). Only set if known from capture parameters */
  compressionQuality?: number;

  /** Whether EXIF metadata was stripped (true = privacy-preserving capture) */
  exifStripped: boolean;

  /** ─── Reference Calibration (Placeholder, Not Currently Used) ─── */

  /** Placeholder for future AR-assisted measurement calibration */
  referenceCalibration: ReferenceCalibration;

  /** ─── Disclaimers & Metadata ─── */

  /**
   * A human-readable disclaimer about what this metadata does NOT represent.
   * Displayed in debug/diagnostics views to prevent misuse.
   */
  disclaimer:
    | 'Single RGB image — no depth data, no 3D reconstruction, no absolute scale.'
    | 'Pixel dimensions alone do not determine real-world food size or volume.';
}

/**
 * Type union for versioned capture metadata (allows future versions).
 * Currently only V1 is defined.
 */
export type FoodCaptureMetadata = FoodCaptureMetadataV1;

/**
 * Helper to check if capture metadata was recorded in a given version.
 */
export function captureMetadataVersion(
  metadata: FoodCaptureMetadata
): metadata is FoodCaptureMetadataV1 {
  return metadata.version === 1;
}
