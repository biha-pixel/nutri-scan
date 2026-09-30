import { z } from "zod";

/**
 * Image Upload Validation Schema
 *
 * This validates that an uploaded image meets our requirements:
 * - Has a valid file name
 * - Is within size limits
 * - Has an allowed MIME type
 */
export const ImageUploadSchema = z.object({
  name: z
    .string()
    .min(1, "File name is required")
    .refine(
      (name) => {
        // Check for common image extensions
        const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
        return validExtensions.some((ext) => name.toLowerCase().endsWith(ext));
      },
      { message: "File must have a valid image extension (.jpg, .jpeg, .png, .webp, .heic)" }
    ),
  size: z
    .number()
    .max(20 * 1024 * 1024, "Image must be smaller than 20MB"),
  type: z
    .string()
    .refine(
      (type) => {
        const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
        return validTypes.includes(type);
      },
      { message: "Image must be a JPEG, PNG, WebP, or HEIC file" }
    ),
});

/**
 * Type inferred from ImageUploadSchema
 */
export type ImageUpload = z.infer<typeof ImageUploadSchema>;