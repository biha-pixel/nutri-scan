/**
 * Nutritional Highlights Types
 *
 * These types define the structure for deterministic, rule-based nutritional highlights.
 *
 * KEY PRINCIPLES:
 * 1. Educational, not medical: Statements inform the user about nutrient density
 *    (e.g., "Good source of protein") without claiming to treat or prevent diseases.
 * 2. Deterministic: The exact same NutritionData input produces the exact same highlights.
 * 3. Traceable: Every highlight cites its regulatory or scientific reference basis (e.g., FDA Daily Value).
 */

import type { NutritionData } from "@/lib/nutrition/types";

/**
 * Significance level of a highlight.
 *
 * - "high": High nutrient density (>= 20% Daily Value)
 * - "good": Meaningful nutrient contribution (10% to 19% Daily Value)
 * - "low": Low in nutrients that are recommended to limit (e.g., low sodium, low saturated fat)
 * - "info": General educational context (e.g., balanced energy source)
 */
export type HighlightLevel = "high" | "good" | "low" | "info";

/**
 * Category of nutrient or dietary factor triggering the highlight.
 */
export type HighlightCategory =
  | "macronutrient"
  | "micronutrient"
  | "mineral"
  | "energy_balance";

/**
 * A single nutritional highlight.
 */
export interface NutritionHighlight {
  /** Short, user-facing label (e.g., "Good source of protein") */
  text: string;

  /** Detailed explanation of the threshold met */
  description: string;

  /** The specific nutrient name (e.g., "protein", "fiber", "vitaminC") */
  nutrient: string;

  /** The nutritional significance level */
  level: HighlightLevel;

  /** Broad category classification */
  category: HighlightCategory;

  /** Regulatory or dietary standard reference (e.g., "FDA 21 CFR 101.54: >= 10% DV (5g)") */
  referenceBasis: string;

  /** Numerical priority for ranking highlights (higher = more notable) */
  priority: number;
}

/**
 * Interface for an individual highlight evaluation rule.
 */
export interface HighlightRule {
  /** Unique identifier for the rule */
  id: string;

  /** Priority for sorting when multiple rules match (1-100) */
  priority: number;

  /**
   * Predicate function that tests whether the nutrition data meets the threshold.
   * Returns a NutritionHighlight if met, or null if not met.
   */
  evaluate: (data: NutritionData) => NutritionHighlight | null;
}

/**
 * Configuration options for the highlight engine.
 */
export interface HighlightEngineOptions {
  /** Minimum number of highlights to return (default: 2) */
  minHighlights?: number;

  /** Maximum number of highlights to return (default: 5) */
  maxHighlights?: number;
}
