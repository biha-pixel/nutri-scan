import { z } from "zod";

/**
 * Image Upload Validation Schema
 *
 * This validates that an uploaded image meets our requirements:
 * - Has a valid file name (or is a blob without extension - magic bytes validate content)
 * - Is within size limits
 * - Has an allowed MIME type (or application/octet-stream for blobs)
 */
const VALID_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const VALID_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/octet-stream", // For blob uploads without extension
];

export const ImageUploadSchema = z.object({
  name: z
    .string()
    .min(1, "File name is required")
    .refine(
      (name) => {
        // Allow blobs/files without extensions - magic byte validation handles content verification
        if (name === "blob" || name === "file" || name === "image") {
          return true;
        }
        return VALID_IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
      },
      { message: "File must have a valid image extension (.jpg, .jpeg, .png, .webp, .heic)" }
    ),
  size: z
    .number()
    .max(20 * 1024 * 1024, "Image must be smaller than 20MB"),
  type: z
    .string()
    .optional()
    .default("image/jpeg")
    .refine(
      (type) => {
        const normalizedType = (type || "image/jpeg").toLowerCase();
        return VALID_IMAGE_MIME_TYPES.includes(normalizedType);
      },
      { message: "Image must be a JPEG, PNG, WebP, or HEIC file" }
    ),
});

/**
 * Type inferred from ImageUploadSchema
 */
export type ImageUpload = z.infer<typeof ImageUploadSchema>;

// ─── Capture Metadata Validation ────────────────────────────────────────────
//
// The mobile app sends metadata about the image capture alongside the food photo.
// This metadata travels via FormData (web) or X-Capture-Metadata header (native Expo).
// We validate it with Zod to ensure it matches the expected shape before using it.

// ─── Capture Metadata Sub-Schemas ─────────────────────────────────────────

const CaptureModeSchema = z.enum(['camera', 'gallery']);

const ImageMimeTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/unknown',
]);

const ImageOrientationSchema = z.enum([
  'portrait',
  'landscape-left',
  'landscape-right',
]);

const ReferenceMarkerTypeSchema = z.enum([
  'credit_card',
  'us_quarter',
  'us_penny',
  'one_euro_coin',
  'ruler',
  'custom',
]);

/**
 * Matches ReferenceCalibrationConfigV1 (enabled = true variant).
 */
const ReferenceCalibrationEnabledSchema = z.object({
  version: z.literal(1),
  enabled: z.literal(true),
  selectedMarkerType: ReferenceMarkerTypeSchema.optional(),
  customDimensionsMm: z
    .object({ widthMm: z.number(), heightMm: z.number() })
    .optional(),
  statusMessage: z.string(),
});

/**
 * Matches { enabled: false } (calibration skipped / gallery upload).
 */
const ReferenceCalibrationDisabledSchema = z.object({
  enabled: z.literal(false),
  // version and statusMessage are optional — the disabled variant doesn't
  // require them per the frontend type.
  version: z.literal(1).optional(),
  statusMessage: z.string().optional(),
});

/**
 * Discriminated union: enabled:true requires the full V1 config;
 * enabled:false is the minimal "skipped" sentinel.
 */
const ReferenceCalibrationSchema = z.discriminatedUnion('enabled', [
  ReferenceCalibrationEnabledSchema,
  ReferenceCalibrationDisabledSchema,
]);

/**
 * Capture Metadata Schema — V1
 *
 * Validates the `FoodCaptureMetadataV1` structure sent by the mobile app.
 * All fields that are optional on the frontend are marked `.optional()` here;
 * required fields use sensible Zod constraints.
 * Width/height can be 0 if not available (camera preview not fully ready).
 */
export const CaptureMetadataSchema = z.object({
  version: z.literal(1),

  // Capture session
  capturedAt: z.string().min(1),
  captureMode: CaptureModeSchema,

  // Image dimensions (measured) - can be 0 if not yet available
  imageWidthPx: z.number().int().nonnegative(),
  imageHeightPx: z.number().int().nonnegative(),

  // Image properties (measured)
  mimeType: ImageMimeTypeSchema,
  estimatedFileSizeBytesApprox: z.number().positive().optional(),

  // Orientation (optional)
  orientation: ImageOrientationSchema.optional(),

  // Capture settings
  compressionQuality: z.number().min(0).max(1).optional(),
  exifStripped: z.boolean(),

  // Reference calibration (always present but may be disabled)
  referenceCalibration: ReferenceCalibrationSchema,

  // Disclaimer string (one of two known literals, or any string for forward-compat)
  disclaimer: z.string().min(1),
});

export type CaptureMetadata = z.infer<typeof CaptureMetadataSchema>;