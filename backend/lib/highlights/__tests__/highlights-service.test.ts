/**
 * Unit Tests — NutritionHighlightService & Highlight Rules
 *
 * These tests verify:
 * 1. The service correctly evaluates all rules and ranks highlights by priority
 * 2. Highlights respect min/max constraints
 * 3. Each individual rule's threshold is correct and documented
 * 4. Null vs. 0 semantics are respected (null = unknown, 0 = confirmed zero)
 * 5. Results are deterministic (same input → same output, always)
 *
 * WHY THESE TESTS MATTER:
 * Highlights are educational — if we claim "high in protein" when the food
 * has only 2g protein, or miss a highlight because of an off-by-one error
 * in the threshold, users will get misleading information.
 *
 * These tests catch:
 * - Threshold miscalculations (e.g., "protein >= 10" vs ">= 10.1")
 * - Null handling errors (returning 0 instead of null for missing nutrients)
 * - Priority ordering bugs (showing low-priority highlights first)
 * - Edge cases (exactly at threshold, missing all nutrients, etc.)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NutritionHighlightService } from "@/lib/highlights/highlights-service";
import type { NutritionData } from "@/lib/nutrition/types";

// ─── Test Helpers ────────────────────────────────────────────────

/**
 * Create a minimal NutritionData object with all nulls.
 * Each test then overrides specific nutrients to test individual rules.
 */
function createMinimalNutritionData(): NutritionData {
  return {
    foodName: "Test Food",
    source: "test",
    sourceId: "test-123",
    servingSize: 100,
    servingUnit: "g",
    calories: null,
    macronutrients: {
      protein: null,
      totalFat: null,
      saturatedFat: null,
      carbohydrates: null,
      fiber: null,
      sugar: null,
    },
    micronutrients: {
      sodium: null,
      cholesterol: null,
      potassium: null,
      vitaminA: null,
      vitaminC: null,
      calcium: null,
      iron: null,
    },
    sourceUrl: "https://example.com",
    matchConfidence: "exact",
  };
}

/**
 * Create realistic banana nutrition data.
 * Used by tests that need multiple nutrients present.
 */
function createBananaNutritionData(): NutritionData {
  return {
    ...createMinimalNutritionData(),
    foodName: "Bananas, raw",
    calories: 89,
    macronutrients: {
      protein: 1.09,
      totalFat: 0.33,
      saturatedFat: 0.112,
      carbohydrates: 22.84,
      fiber: 2.6,
      sugar: 12.23,
    },
    micronutrients: {
      sodium: 1,
      cholesterol: 0,
      potassium: 358,
      vitaminA: null,
      vitaminC: 8.7,
      calcium: 5,
      iron: 0.26,
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("NutritionHighlightService", () => {
  let service: NutritionHighlightService;

  beforeEach(() => {
    service = new NutritionHighlightService();
  });

  // ── generateHighlights ──────────────────────────────────────

  describe("generateHighlights", () => {
    it("returns empty array when no rules match", () => {
      const data = createMinimalNutritionData();
      const highlights = service.generateHighlights(data);

      expect(highlights).toHaveLength(0);
    });

    it("returns highlights sorted by priority (highest first)", () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 15; // matches protein_high (priority 95)
      data.macronutrients.fiber = 10;   // matches fiber_high (priority 92)

      const highlights = service.generateHighlights(data);

      expect(highlights).toHaveLength(2);
      expect(highlights[0].priority).toBe(95); // protein_high
      expect(highlights[1].priority).toBe(92); // fiber_high
    });

    it("respects maxHighlights option", () => {
      const data = createBananaNutritionData();
      // Add enough nutrients to trigger many rules
      data.macronutrients.protein = 50;
      data.macronutrients.fiber = 28;
      data.micronutrients.vitaminC = 200;
      data.micronutrients.potassium = 2000;
      data.micronutrients.calcium = 500;

      const highlights = service.generateHighlights(data, { maxHighlights: 2 });

      expect(highlights.length).toBeLessThanOrEqual(2);
      expect(highlights.length).toBeGreaterThan(0);
    });

    it("does not add fake highlights to meet minHighlights", () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 5; // matches protein_good only

      const highlights = service.generateHighlights(data, {
        minHighlights: 3,
        maxHighlights: 5,
      });

      // Only 1 rule matched; we should return 1 highlight, not invent 3
      expect(highlights).toHaveLength(1);
    });

    it("handles realistic multi-nutrient data (banana example)", () => {
      const data = createBananaNutritionData();

      const highlights = service.generateHighlights(data);

      // Banana should have at least a few highlights (carbs, vitamin C, potassium, etc.)
      expect(highlights.length).toBeGreaterThan(0);
      expect(highlights.length).toBeLessThanOrEqual(5);

      // Each highlight should have required fields
      for (const h of highlights) {
        expect(h.text).toBeDefined();
        expect(h.text.length).toBeGreaterThan(0);
        expect(h.description).toBeDefined();
        expect(h.nutrient).toBeDefined();
        expect(h.level).toMatch(/high|good|low|info/);
        expect(h.category).toBeDefined();
        expect(h.referenceBasis).toBeDefined();
        expect(typeof h.priority).toBe("number");
        expect(h.priority).toBeGreaterThanOrEqual(0);
        expect(h.priority).toBeLessThanOrEqual(100);
      }
    });
  });

  // ── Protein Rules ───────────────────────────────────────────

  describe("Protein Rules", () => {
    it('triggers "protein_high" when protein >= 10g (>= 20% DV)', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 10;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "protein",
          level: "high",
          text: "High in protein",
        })
      );
    });

    it('does not trigger "protein_high" when protein < 10g', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 9.99;

      const highlights = service.generateHighlights(data);

      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "protein",
          level: "high",
        })
      );
    });

    it('triggers "protein_good" when 5g <= protein < 10g (10-19% DV)', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 7;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "protein",
          level: "good",
          text: "Good source of protein",
        })
      );
    });

    it('does not trigger protein rules when protein is null', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = null;

      const highlights = service.generateHighlights(data);

      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "protein",
        })
      );
    });

    it("includes FDA reference basis in protein highlights", () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 15;

      const highlights = service.generateHighlights(data);
      const proteinHighlight = highlights.find((h) => h.nutrient === "protein");

      expect(proteinHighlight?.referenceBasis).toContain("FDA 21 CFR 101.54");
      expect(proteinHighlight?.referenceBasis).toContain("20% DV");
    });
  });

  // ── Dietary Fiber Rules ─────────────────────────────────────

  describe("Dietary Fiber Rules", () => {
    it('triggers "fiber_high" when fiber >= 5.6g (>= 20% DV of 28g)', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.fiber = 5.6;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "fiber",
          level: "high",
          text: "High in dietary fiber",
        })
      );
    });

    it('triggers "fiber_good" when 2.8g <= fiber < 5.6g (10-19% DV)', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.fiber = 4;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "fiber",
          level: "good",
          text: "Provides dietary fiber",
        })
      );
    });

    it('does not trigger fiber rules when fiber < 2.8g', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.fiber = 2.7;

      const highlights = service.generateHighlights(data);

      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "fiber",
        })
      );
    });
  });

  // ── Vitamin C Rules ─────────────────────────────────────────

  describe("Vitamin C Rules", () => {
    it('triggers "vitamin_c_high" when vitaminC >= 18mg (>= 20% DV of 90mg)', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.vitaminC = 18;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "vitaminC",
          level: "high",
          text: "Excellent source of Vitamin C",
        })
      );
    });

    it('triggers "vitamin_c_good" when 9mg <= vitaminC < 18mg (10-19% DV)', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.vitaminC = 15;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "vitaminC",
          level: "good",
          text: "Contains Vitamin C",
        })
      );
    });
  });

  // ── Potassium Rules ─────────────────────────────────────────

  describe("Potassium Rules", () => {
    it('triggers "potassium_high" when potassium >= 940mg (>= 20% DV of 4700mg)', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.potassium = 940;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "potassium",
          level: "high",
        })
      );
    });

    it('triggers "potassium_good" when 350mg <= potassium < 940mg', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.potassium = 500;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "potassium",
          level: "good",
        })
      );
    });
  });

  // ── Calcium Rules ───────────────────────────────────────────

  describe("Calcium Rules", () => {
    it('triggers "calcium_high" when calcium >= 260mg (>= 20% DV of 1300mg)', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.calcium = 260;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "calcium",
          level: "high",
          text: "Excellent source of calcium",
        })
      );
    });

    it('triggers "calcium_good" when 130mg <= calcium < 260mg (10-19% DV)', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.calcium = 200;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "calcium",
          level: "good",
        })
      );
    });
  });

  // ── Iron Rules ──────────────────────────────────────────────

  describe("Iron Rules", () => {
    it('triggers "iron_high" when iron >= 3.6mg (>= 20% DV of 18mg)', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.iron = 3.6;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "iron",
          level: "high",
        })
      );
    });

    it('triggers "iron_good" when 1.8mg <= iron < 3.6mg (10-19% DV)', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.iron = 2.5;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "iron",
          level: "good",
        })
      );
    });
  });

  // ── Sodium Rules ────────────────────────────────────────────

  describe("Sodium Rules", () => {
    it('triggers "sodium_low" when sodium <= 140mg (FDA daily value limit)', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.sodium = 140;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "sodium",
          level: "low",
          text: "Low in sodium",
        })
      );
    });

    it('does not trigger "sodium_low" when sodium > 140mg', () => {
      const data = createMinimalNutritionData();
      data.micronutrients.sodium = 141;

      const highlights = service.generateHighlights(data);

      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "sodium",
          level: "low",
        })
      );
    });

    it("references FDA 21 CFR 101.61 for low sodium", () => {
      const data = createMinimalNutritionData();
      data.micronutrients.sodium = 100;

      const highlights = service.generateHighlights(data);
      const sodiumHighlight = highlights.find((h) => h.nutrient === "sodium");

      expect(sodiumHighlight?.referenceBasis).toContain("101.61");
    });
  });

  // ── Saturated Fat Rules ─────────────────────────────────────

  describe("Saturated Fat Rules", () => {
    it('triggers "sat_fat_low" when saturatedFat <= 1g and totalFat is known', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.saturatedFat = 0.5;
      data.macronutrients.totalFat = 5; // Must be documented

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "saturatedFat",
          level: "low",
          text: "Low in saturated fat",
        })
      );
    });

    it('does not trigger "sat_fat_low" when saturatedFat > 1g', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.saturatedFat = 1.1;
      data.macronutrients.totalFat = 5;

      const highlights = service.generateHighlights(data);

      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "saturatedFat",
          level: "low",
        })
      );
    });

    it('does not trigger "sat_fat_low" when totalFat is null (not documented)', () => {
      const data = createMinimalNutritionData();
      data.macronutrients.saturatedFat = 0.5;
      data.macronutrients.totalFat = null; // totalFat is unknown

      const highlights = service.generateHighlights(data);

      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "saturatedFat",
        })
      );
    });
  });

  // ── Calorie Rules ───────────────────────────────────────────

  describe("Calorie Rules", () => {
    it('triggers "calorie_low" when calories <= 40 (FDA definition)', () => {
      const data = createMinimalNutritionData();
      data.calories = 40;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "calories",
          level: "low",
          text: "Low-calorie food",
        })
      );
    });

    it('does not trigger "calorie_low" when calories > 40', () => {
      const data = createMinimalNutritionData();
      data.calories = 41;

      const highlights = service.generateHighlights(data);

      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "calories",
          level: "low",
          text: "Low-calorie food",
        })
      );
    });

    it("references FDA 21 CFR 101.60 for low calorie", () => {
      const data = createMinimalNutritionData();
      data.calories = 30;

      const highlights = service.generateHighlights(data);
      const calorieHighlight = highlights.find(
        (h) => h.text === "Low-calorie food"
      );

      expect(calorieHighlight?.referenceBasis).toContain("101.60");
    });
  });

  // ── Null vs Zero Semantics ──────────────────────────────────

  describe("Null vs Zero Semantics", () => {
    it("does not trigger rules when nutrient is null (unknown)", () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = null; // unknown, not zero

      const highlights = service.generateHighlights(data);

      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "protein",
        })
      );
    });

    it("does trigger rules when nutrient is 0 (confirmed zero) and rule allows it", () => {
      const data = createMinimalNutritionData();
      data.micronutrients.cholesterol = 0; // confirmed: no cholesterol
      data.micronutrients.sodium = 0;       // confirmed: no sodium

      const highlights = service.generateHighlights(data);

      // sodium_low should trigger: 0 <= 140
      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "sodium",
          level: "low",
        })
      );
    });

    it("correctly differentiates between 0 and null in banana data", () => {
      const data = createBananaNutritionData();

      // In banana data: cholesterol = 0 (none), vitaminA = null (unknown)
      expect(data.micronutrients.cholesterol).toBe(0);
      expect(data.micronutrients.vitaminA).toBeNull();

      const highlights = service.generateHighlights(data);

      // Should not generate a vitaminA highlight (null)
      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "vitaminA",
        })
      );

      // cholesterol = 0 is fine; it just doesn't trigger any "low in cholesterol" rule
      // (which doesn't exist in our ruleset)
    });
  });

  // ── Debug Methods ───────────────────────────────────────────

  describe("debugGetMatchedRuleIds", () => {
    it("returns the IDs of all rules that matched", () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 15; // protein_high
      data.macronutrients.fiber = 10;   // fiber_high

      const matchedIds = service.debugGetMatchedRuleIds(data);

      expect(matchedIds).toContain("protein_high");
      expect(matchedIds).toContain("fiber_high");
      expect(matchedIds.length).toBe(2);
    });

    it("returns empty array when no rules match", () => {
      const data = createMinimalNutritionData();
      const matchedIds = service.debugGetMatchedRuleIds(data);

      expect(matchedIds).toHaveLength(0);
    });
  });

  describe("getMatchingRuleCount", () => {
    it("counts the number of matching rules", () => {
      const data = createBananaNutritionData();
      const count = service.getMatchingRuleCount(data);

      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(20); // We have ~20 rules total
    });

    it("returns 0 when no rules match", () => {
      const data = createMinimalNutritionData();
      const count = service.getMatchingRuleCount(data);

      expect(count).toBe(0);
    });
  });

  // ── Determinism ─────────────────────────────────────────────

  describe("Determinism", () => {
    it("produces identical highlights on repeated calls with same data", () => {
      const data = createBananaNutritionData();

      const result1 = service.generateHighlights(data);
      const result2 = service.generateHighlights(data);

      expect(result1).toEqual(result2);
    });

    it("produces deterministic output regardless of call order", () => {
      const data1 = createMinimalNutritionData();
      data1.macronutrients.protein = 20;
      data1.micronutrients.vitaminC = 50;

      const data2 = createMinimalNutritionData();
      data2.micronutrients.vitaminC = 50;
      data2.macronutrients.protein = 20;

      const result1 = service.generateHighlights(data1);
      const result2 = service.generateHighlights(data2);

      expect(result1).toEqual(result2);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("handles thresholds exactly at the boundary", () => {
      // Protein: exactly 10g (the boundary for high vs good)
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 10;

      const highlights = service.generateHighlights(data);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "protein",
          level: "high",
        })
      );
    });

    it("handles very large nutrient values", () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 100; // unrealistic but should not break

      const highlights = service.generateHighlights(data);

      // Should still generate a protein_high highlight
      expect(highlights).toContainEqual(
        expect.objectContaining({
          nutrient: "protein",
          level: "high",
        })
      );
    });

    it("handles very small positive nutrient values", () => {
      const data = createMinimalNutritionData();
      data.macronutrients.protein = 0.001; // just above zero

      const highlights = service.generateHighlights(data);

      // Should not trigger any protein rule
      expect(highlights).not.toContainEqual(
        expect.objectContaining({
          nutrient: "protein",
        })
      );
    });
  });
});
