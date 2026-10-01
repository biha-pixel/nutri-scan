/**
 * Nutritional Highlight Rules
 *
 * This file defines the deterministic rule engine for extracting educational
 * highlights from normalized nutrition data.
 *
 * REGULATORY & SCIENTIFIC REFERENCE SOURCES:
 * - US FDA 21 CFR 101.54 (Nutrient content claims for "Good source" and "High / Excellent source")
 *   - "High" / "Rich in" / "Excellent source": >= 20% of Daily Value (DV) per reference amount
 *   - "Good source" / "Provides" / "Contains": 10% to 19% of Daily Value (DV) per reference amount
 * - US FDA 21 CFR 101.60 & 101.61 (Calorie and Sodium content claims)
 *   - "Low calorie": <= 40 calories per serving
 *   - "Low sodium": <= 140 mg per serving
 *   - "Low saturated fat": <= 1 g per serving
 * - Reference Daily Values (DV for 2,000 calorie adult diet):
 *   - Protein: 50 g
 *   - Dietary Fiber: 28 g
 *   - Potassium: 4,700 mg
 *   - Vitamin C: 90 mg
 *   - Vitamin A: 900 mcg RAE
 *   - Calcium: 1,300 mg
 *   - Iron: 18 mg
 *
 * NO MEDICAL CLAIMS:
 * None of these rules diagnose conditions or claim to prevent/cure diseases.
 * They communicate objective nutrient density relative to standard dietary benchmarks.
 */

import type { NutritionData } from "@/lib/nutrition/types";
import type { HighlightRule, NutritionHighlight } from "./types";

export const HIGHLIGHT_RULES: HighlightRule[] = [
  // ─── Protein Rules ──────────────────────────────────────────────
  {
    id: "protein_high",
    priority: 95,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const protein = data.macronutrients.protein;
      if (protein !== null && protein >= 10) {
        return {
          text: "High in protein",
          description: `Contains ${protein}g protein (>= 20% of Daily Value).`,
          nutrient: "protein",
          level: "high",
          category: "macronutrient",
          referenceBasis: "FDA 21 CFR 101.54 (>= 20% DV = 10g)",
          priority: 95,
        };
      }
      return null;
    },
  },
  {
    id: "protein_good",
    priority: 85,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const protein = data.macronutrients.protein;
      if (protein !== null && protein >= 5 && protein < 10) {
        return {
          text: "Good source of protein",
          description: `Provides ${protein}g protein (10-19% of Daily Value).`,
          nutrient: "protein",
          level: "good",
          category: "macronutrient",
          referenceBasis: "FDA 21 CFR 101.54 (10-19% DV = 5-9.9g)",
          priority: 85,
        };
      }
      return null;
    },
  },

  // ─── Dietary Fiber Rules ─────────────────────────────────────────
  {
    id: "fiber_high",
    priority: 92,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const fiber = data.macronutrients.fiber;
      if (fiber !== null && fiber >= 5.6) {
        return {
          text: "High in dietary fiber",
          description: `Contains ${fiber}g dietary fiber (>= 20% of Daily Value).`,
          nutrient: "fiber",
          level: "high",
          category: "macronutrient",
          referenceBasis: "FDA 21 CFR 101.54 (>= 20% DV = 5.6g)",
          priority: 92,
        };
      }
      return null;
    },
  },
  {
    id: "fiber_good",
    priority: 82,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const fiber = data.macronutrients.fiber;
      if (fiber !== null && fiber >= 2.8 && fiber < 5.6) {
        return {
          text: "Provides dietary fiber",
          description: `Provides ${fiber}g dietary fiber (10-19% of Daily Value).`,
          nutrient: "fiber",
          level: "good",
          category: "macronutrient",
          referenceBasis: "FDA 21 CFR 101.54 (10-19% DV = 2.8-5.5g)",
          priority: 82,
        };
      }
      return null;
    },
  },

  // ─── Vitamin C Rules ─────────────────────────────────────────────
  {
    id: "vitamin_c_high",
    priority: 88,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const vitC = data.micronutrients.vitaminC;
      if (vitC !== null && vitC >= 18) {
        return {
          text: "Excellent source of Vitamin C",
          description: `Contains ${vitC}mg Vitamin C (>= 20% of Daily Value).`,
          nutrient: "vitaminC",
          level: "high",
          category: "micronutrient",
          referenceBasis: "FDA 21 CFR 101.54 (>= 20% DV = 18mg)",
          priority: 88,
        };
      }
      return null;
    },
  },
  {
    id: "vitamin_c_good",
    priority: 78,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const vitC = data.micronutrients.vitaminC;
      if (vitC !== null && vitC >= 9 && vitC < 18) {
        return {
          text: "Contains Vitamin C",
          description: `Provides ${vitC}mg Vitamin C (10-19% of Daily Value).`,
          nutrient: "vitaminC",
          level: "good",
          category: "micronutrient",
          referenceBasis: "FDA 21 CFR 101.54 (10-19% DV = 9-17.9mg)",
          priority: 78,
        };
      }
      return null;
    },
  },

  // ─── Potassium Rules ─────────────────────────────────────────────
  {
    id: "potassium_high",
    priority: 86,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const pot = data.micronutrients.potassium;
      if (pot !== null && pot >= 940) {
        return {
          text: "High in potassium",
          description: `Contains ${pot}mg potassium (>= 20% of Daily Value).`,
          nutrient: "potassium",
          level: "high",
          category: "mineral",
          referenceBasis: "FDA 21 CFR 101.54 (>= 20% DV = 940mg)",
          priority: 86,
        };
      }
      return null;
    },
  },
  {
    id: "potassium_good",
    priority: 76,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const pot = data.micronutrients.potassium;
      if (pot !== null && pot >= 350 && pot < 940) {
        return {
          text: "Contains potassium",
          description: `Provides ${pot}mg potassium (>= 350mg per serving).`,
          nutrient: "potassium",
          level: "good",
          category: "mineral",
          referenceBasis: "FDA 21 CFR 101.54 & Dietary Guidelines (350-939mg)",
          priority: 76,
        };
      }
      return null;
    },
  },

  // ─── Vitamin A Rules ─────────────────────────────────────────────
  {
    id: "vitamin_a_high",
    priority: 84,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const vitA = data.micronutrients.vitaminA;
      if (vitA !== null && vitA >= 180) {
        return {
          text: "Rich in Vitamin A",
          description: `Contains ${vitA}µg RAE Vitamin A (>= 20% of Daily Value).`,
          nutrient: "vitaminA",
          level: "high",
          category: "micronutrient",
          referenceBasis: "FDA 21 CFR 101.54 (>= 20% DV = 180µg)",
          priority: 84,
        };
      }
      return null;
    },
  },
  {
    id: "vitamin_a_good",
    priority: 74,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const vitA = data.micronutrients.vitaminA;
      if (vitA !== null && vitA >= 90 && vitA < 180) {
        return {
          text: "Contains Vitamin A",
          description: `Provides ${vitA}µg RAE Vitamin A (10-19% of Daily Value).`,
          nutrient: "vitaminA",
          level: "good",
          category: "micronutrient",
          referenceBasis: "FDA 21 CFR 101.54 (10-19% DV = 90-179µg)",
          priority: 74,
        };
      }
      return null;
    },
  },

  // ─── Calcium Rules ───────────────────────────────────────────────
  {
    id: "calcium_high",
    priority: 83,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const calcium = data.micronutrients.calcium;
      if (calcium !== null && calcium >= 260) {
        return {
          text: "Excellent source of calcium",
          description: `Contains ${calcium}mg calcium (>= 20% of Daily Value).`,
          nutrient: "calcium",
          level: "high",
          category: "mineral",
          referenceBasis: "FDA 21 CFR 101.54 (>= 20% DV = 260mg)",
          priority: 83,
        };
      }
      return null;
    },
  },
  {
    id: "calcium_good",
    priority: 73,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const calcium = data.micronutrients.calcium;
      if (calcium !== null && calcium >= 130 && calcium < 260) {
        return {
          text: "Good source of calcium",
          description: `Provides ${calcium}mg calcium (10-19% of Daily Value).`,
          nutrient: "calcium",
          level: "good",
          category: "mineral",
          referenceBasis: "FDA 21 CFR 101.54 (10-19% DV = 130-259mg)",
          priority: 73,
        };
      }
      return null;
    },
  },

  // ─── Iron Rules ──────────────────────────────────────────────────
  {
    id: "iron_high",
    priority: 81,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const iron = data.micronutrients.iron;
      if (iron !== null && iron >= 3.6) {
        return {
          text: "High in iron",
          description: `Contains ${iron}mg iron (>= 20% of Daily Value).`,
          nutrient: "iron",
          level: "high",
          category: "mineral",
          referenceBasis: "FDA 21 CFR 101.54 (>= 20% DV = 3.6mg)",
          priority: 81,
        };
      }
      return null;
    },
  },
  {
    id: "iron_good",
    priority: 71,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const iron = data.micronutrients.iron;
      if (iron !== null && iron >= 1.8 && iron < 3.6) {
        return {
          text: "Good source of iron",
          description: `Provides ${iron}mg iron (10-19% of Daily Value).`,
          nutrient: "iron",
          level: "good",
          category: "mineral",
          referenceBasis: "FDA 21 CFR 101.54 (10-19% DV = 1.8-3.5mg)",
          priority: 71,
        };
      }
      return null;
    },
  },

  // ─── Sodium Rules ────────────────────────────────────────────────
  {
    id: "sodium_low",
    priority: 65,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const sodium = data.micronutrients.sodium;
      if (sodium !== null && sodium <= 140) {
        return {
          text: "Low in sodium",
          description: `Contains ${sodium}mg sodium (<= 140mg per serving).`,
          nutrient: "sodium",
          level: "low",
          category: "mineral",
          referenceBasis: "FDA 21 CFR 101.61 (<= 140mg per serving)",
          priority: 65,
        };
      }
      return null;
    },
  },

  // ─── Saturated Fat Rules ─────────────────────────────────────────
  {
    id: "sat_fat_low",
    priority: 64,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const satFat = data.macronutrients.saturatedFat;
      const totalFat = data.macronutrients.totalFat;
      // We check that saturated fat is explicitly reported and <= 1g,
      // and total fat is documented.
      if (satFat !== null && satFat <= 1 && totalFat !== null) {
        return {
          text: "Low in saturated fat",
          description: `Contains ${satFat}g saturated fat (<= 1g per serving).`,
          nutrient: "saturatedFat",
          level: "low",
          category: "macronutrient",
          referenceBasis: "FDA 21 CFR 101.62 (<= 1g per serving)",
          priority: 64,
        };
      }
      return null;
    },
  },

  // ─── Caloric Density / Energy Rules ──────────────────────────────
  {
    id: "calorie_low",
    priority: 60,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const cal = data.calories;
      if (cal !== null && cal > 0 && cal <= 40) {
        return {
          text: "Low-calorie food",
          description: `Provides ${cal} kcal per serving (<= 40 kcal).`,
          nutrient: "calories",
          level: "low",
          category: "energy_balance",
          referenceBasis: "FDA 21 CFR 101.60 (<= 40 kcal per serving)",
          priority: 60,
        };
      }
      return null;
    },
  },

  // ─── Complex Carbohydrate / Energy Balance Fallback ──────────────
  {
    id: "carbs_energy",
    priority: 50,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const carbs = data.macronutrients.carbohydrates;
      const sugar = data.macronutrients.sugar;
      if (carbs !== null && carbs >= 15 && (sugar === null || sugar <= 10)) {
        return {
          text: "Provides carbohydrate energy",
          description: `Provides ${carbs}g carbohydrates per serving.`,
          nutrient: "carbohydrates",
          level: "info",
          category: "energy_balance",
          referenceBasis: "Dietary Guidelines for Americans (Macro energy profile)",
          priority: 50,
        };
      }
      return null;
    },
  },

  // ─── Naturally Low Calorie / Whole Food Baseline Fallback ────────
  {
    id: "general_nutrient_density",
    priority: 30,
    evaluate: (data: NutritionData): NutritionHighlight | null => {
      const cal = data.calories;
      if (cal !== null && cal > 40 && cal <= 150) {
        return {
          text: "Moderate caloric density",
          description: `Provides ${cal} kcal per ${data.servingSize}${data.servingUnit} serving.`,
          nutrient: "calories",
          level: "info",
          category: "energy_balance",
          referenceBasis: "Standard serving nutritional density profile",
          priority: 30,
        };
      }
      return null;
    },
  },
];
