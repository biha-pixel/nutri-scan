import { z } from "zod";

/**
 * Image Upload Validation Schema
 *
 * This validates that an uploaded image meets our requirements:
 * - Has a valid file name
 * - Is within size limits
 * - Has an allowed MIME type
 */
const VALID_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const VALID_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/octet-stream",
];

export const ImageUploadSchema = z.object({
  name: z
    .string()
    .min(1, "File name is required")
    .refine(
      (name) => {
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
        return VALID_IMAGE_MIME_TYPES.includes((type || "").toLowerCase());
      },
      { message: "Image must be a JPEG, PNG, WebP, or HEIC file" }
    ),
});

/**
 * Type inferred from ImageUploadSchema
 */
export type ImageUpload = z.infer<typeof ImageUploadSchema>;