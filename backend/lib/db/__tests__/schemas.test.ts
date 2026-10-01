/**
 * Unit Tests — Database Schemas & Runtime Validation
 *
 * Verifies:
 * 1. CreateScanInputSchema accepts valid payloads and enforces constraints
 * 2. Nutrition fields preserve null and numeric values
 * 3. ScanHistoryQuerySchema validates UUIDs, pagination limits, and defaults
 */

import { describe, it, expect } from "vitest";
import {
  CreateScanInputSchema,
  CreateScanItemInputSchema,
  ScanHistoryQuerySchema,
  MacronutrientsSchema,
  MicronutrientsSchema,
} from "../schemas";

describe("Database Zod Schemas", () => {
  describe("MacronutrientsSchema & MicronutrientsSchema", () => {
    it("defaults missing nutrient fields to null", () => {
      const parsedMacros = MacronutrientsSchema.parse({});
      expect(parsedMacros.protein).toBeNull();
      expect(parsedMacros.totalFat).toBeNull();
      expect(parsedMacros.saturatedFat).toBeNull();
      expect(parsedMacros.carbohydrates).toBeNull();
      expect(parsedMacros.fiber).toBeNull();
      expect(parsedMacros.sugar).toBeNull();

      const parsedMicros = MicronutrientsSchema.parse({});
      expect(parsedMicros.sodium).toBeNull();
      expect(parsedMicros.calcium).toBeNull();
    });

    it("preserves 0 as a valid confirmed value (not converted to null)", () => {
      const parsedMacros = MacronutrientsSchema.parse({
        protein: 0,
        totalFat: 0,
      });
      expect(parsedMacros.protein).toBe(0);
      expect(parsedMacros.totalFat).toBe(0);
      expect(parsedMacros.carbohydrates).toBeNull();
    });
  });

  describe("CreateScanItemInputSchema", () => {
    it("validates a complete scan item", () => {
      const itemData = {
        foodName: "Grilled Chicken Breast",
        confidence: 0.94,
        nutritionSource: "usda_fdc",
        nutritionId: "171077",
        servingBasis: "150g",
        nutrients: {
          calories: 247.5,
          macronutrients: {
            protein: 46.5,
            totalFat: 5.4,
            saturatedFat: 1.5,
            carbohydrates: 0,
            fiber: 0,
            sugar: 0,
          },
          micronutrients: {
            sodium: 111,
            cholesterol: 127.5,
            potassium: 384,
            vitaminA: null,
            vitaminC: null,
            calcium: 22.5,
            iron: 1.56,
          },
        },
        highlights: [
          {
            text: "High in protein",
            description: "Contains 46.5g protein",
            nutrient: "protein",
            level: "high",
            category: "macronutrient" as const,
            referenceBasis: "FDA 21 CFR 101.54",
            priority: 95,
          },
        ],
      };

      const result = CreateScanItemInputSchema.safeParse(itemData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.foodName).toBe("Grilled Chicken Breast");
        expect(result.data.confidence).toBe(0.94);
        expect(result.data.nutrients.macronutrients.protein).toBe(46.5);
      }
    });

    it("rejects items with missing food name or invalid confidence", () => {
      const invalidItem = {
        foodName: "",
        confidence: 1.5, // exceeds max 1.0
      };

      const result = CreateScanItemInputSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe("CreateScanInputSchema", () => {
    it("validates a full scan with multiple items", () => {
      const scanData = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        imageUrl: null,
        items: [
          {
            foodName: "Banana",
            confidence: 0.98,
            servingBasis: "100g",
            nutrients: {
              calories: 89,
            },
          },
        ],
      };

      const result = CreateScanInputSchema.safeParse(scanData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe("550e8400-e29b-41d4-a716-446655440000");
        expect(result.data.items).toHaveLength(1);
        expect(result.data.imageUrl).toBeNull();
      }
    });

    it("rejects scans with zero items", () => {
      const emptyScan = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        items: [],
      };

      const result = CreateScanInputSchema.safeParse(emptyScan);
      expect(result.success).toBe(false);
    });

    it("rejects malformed user UUIDs", () => {
      const invalidUuidScan = {
        userId: "not-a-uuid",
        items: [
          {
            foodName: "Apple",
            confidence: 0.9,
          },
        ],
      };

      const result = CreateScanInputSchema.safeParse(invalidUuidScan);
      expect(result.success).toBe(false);
    });
  });

  describe("ScanHistoryQuerySchema", () => {
    it("validates and parses query parameters with defaults", () => {
      const query = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
      };

      const result = ScanHistoryQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it("coerces string numbers for limit and offset", () => {
      const query = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        limit: "10",
        offset: "30",
      };

      const result = ScanHistoryQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(30);
      }
    });

    it("enforces maximum limit constraint of 50", () => {
      const query = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        limit: 100,
      };

      const result = ScanHistoryQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });
});
