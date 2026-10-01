/**
 * File Upload Security Validation
 *
 * This module provides security-focused validation for uploaded files,
 * beyond basic schema checks. It validates file headers (magic bytes)
 * to prevent MIME type spoofing attacks.
 *
 * WHY THIS MATTERS:
 * A malicious user could rename a .exe file to .jpg and upload it.
 * Checking only the extension or the client-provided MIME type is not enough.
 * We must inspect the actual file content to verify its true type.
 */

/**
 * Magic byte signatures for supported image formats.
 * These are the first few bytes that uniquely identify each file type.
 *
 * Sources:
 * - JPEG: FF D8 FF (all JPEGs start with this)
 * - PNG: 89 50 4E 47 0D 0A 1A 0A (PNG signature)
 * - WebP: 52 49 46 46 ... 57 45 42 50 ("RIFF" + "WEBP")
 * - HEIC/HEIF: Multiple possible signatures (ftyp box variations)
 */
const IMAGE_SIGNATURES = {
  jpeg: [
    [0xff, 0xd8, 0xff], // JPEG/JFIF
  ],
  png: [
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  ],
  webp: [
    [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], // RIFF....WEBP
  ],
  heic: [
    [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], // ....ftypheic
    [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31], // ....ftypmif1
  ],
} as const;

/**
 * Check if a buffer matches a magic byte signature.
 * null in the signature means "any byte" (used for length fields that vary).
 */
function matchesSignature(buffer: Buffer, signature: readonly (number | null)[]): boolean {
  if (buffer.length < signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== null && buffer[i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Validate image file header to prevent MIME type spoofing.
 *
 * Returns the detected MIME type if valid, or null if the file is not
 * a recognized image format.
 *
 * @param buffer - The file content (first ~16 bytes are sufficient)
 * @returns The actual MIME type, or null if unrecognized
 */
export function validateImageFileHeader(buffer: Buffer): string | null {
  // Check JPEG
  for (const sig of IMAGE_SIGNATURES.jpeg) {
    if (matchesSignature(buffer, sig)) {
      return "image/jpeg";
    }
  }

  // Check PNG
  for (const sig of IMAGE_SIGNATURES.png) {
    if (matchesSignature(buffer, sig)) {
      return "image/png";
    }
  }

  // Check WebP
  for (const sig of IMAGE_SIGNATURES.webp) {
    if (matchesSignature(buffer, sig)) {
      return "image/webp";
    }
  }

  // Check HEIC/HEIF
  for (const sig of IMAGE_SIGNATURES.heic) {
    if (matchesSignature(buffer, sig)) {
      return "image/heic";
    }
  }

  return null;
}

/**
 * Strip EXIF metadata from an image buffer.
 *
 * EXIF data can contain GPS coordinates, camera serial numbers, and other
 * privacy-sensitive information. We strip it before storing images.
 *
 * For now, this is a placeholder that returns the original buffer.
 * A production implementation would use a library like `exif-parser` or `sharp`.
 *
 * @param buffer - The original image file
 * @param mimeType - The validated MIME type
 * @returns The image with EXIF metadata removed
 */
export function stripExifMetadata(buffer: Buffer, mimeType: string): Buffer {
  // TODO: Implement EXIF stripping with a lightweight library
  // Suggested libraries:
  // - `sharp` (full-featured, requires native dependencies)
  // - `piexifjs` (pure JS, JPEG only)
  //
  // For MVP, we return the original buffer. EXIF stripping should be
  // implemented before storing user images long-term.

  return buffer;
}
