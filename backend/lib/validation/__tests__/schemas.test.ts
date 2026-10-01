/**
 * Unit Tests — API Validation Schemas
 *
 * Verifies request validation at the HTTP entry boundary:
 * 1. File name extensions (.jpg, .jpeg, .png, .webp, .heic)
 * 2. MIME type validation against whitelist
 * 3. File size constraints (20MB threshold boundary)
 */

import { describe, it, expect } from "vitest";
import { ImageUploadSchema } from "../schemas";

describe("API Validation Schemas — ImageUploadSchema", () => {
  describe("Valid Upload Payloads", () => {
    it("accepts a standard JPEG upload under 20MB", () => {
      const payload = {
        name: "meal_photo.jpg",
        size: 3.5 * 1024 * 1024,
        type: "image/jpeg",
      };

      const result = ImageUploadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("accepts supported extensions across case variations (.PNG, .WebP, .HEIC)", () => {
      const extensions = [
        { name: "scan.jpeg", type: "image/jpeg" },
        { name: "photo.PNG", type: "image/png" },
        { name: "plate.webp", type: "image/webp" },
        { name: "food.HEIC", type: "image/heic" },
      ];

      for (const item of extensions) {
        const result = ImageUploadSchema.safeParse({
          name: item.name,
          size: 1024 * 100,
          type: item.type,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Invalid & Rejected Uploads", () => {
    it("rejects empty file names", () => {
      const result = ImageUploadSchema.safeParse({
        name: "",
        size: 5000,
        type: "image/jpeg",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("File name is required");
      }
    });

    it("rejects unsupported file extensions (e.g. .pdf, .exe, .gif)", () => {
      const invalidFiles = [
        { name: "document.pdf", type: "application/pdf" },
        { name: "script.sh", type: "text/plain" },
        { name: "animation.gif", type: "image/gif" },
      ];

      for (const item of invalidFiles) {
        const result = ImageUploadSchema.safeParse({
          name: item.name,
          size: 1024,
          type: item.type,
        });
        expect(result.success).toBe(false);
      }
    });

    it("rejects files exceeding the 20MB limit", () => {
      const oversizedPayload = {
        name: "huge_photo.jpg",
        size: 20 * 1024 * 1024 + 1, // 20MB + 1 byte
        type: "image/jpeg",
      };

      const result = ImageUploadSchema.safeParse(oversizedPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Image must be smaller than 20MB");
      }
    });

    it("rejects mismatched MIME types even if extension is spoofed", () => {
      const spoofedPayload = {
        name: "photo.jpg",
        size: 5000,
        type: "application/x-executable",
      };

      const result = ImageUploadSchema.safeParse(spoofedPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "Image must be a JPEG, PNG, WebP, or HEIC file"
        );
      }
    });
  });
});
