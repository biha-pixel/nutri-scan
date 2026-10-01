/**
 * Nutritional Highlights Module
 *
 * This module provides a deterministic, rule-based system for extracting
 * educational nutritional highlights from normalized nutrition data.
 *
 * KEY PRINCIPLES:
 * 1. Educational, not medical — informs about nutrient density without medical claims
 * 2. Deterministic — same input always produces same output
 * 3. Traceable — every highlight cites regulatory/scientific reference (FDA, etc.)
 *
 * USAGE:
 * ```typescript
 * import { NutritionHighlightService } from "@/lib/highlights";
 *
 * const service = new NutritionHighlightService();
 * const highlights = service.generateHighlights(nutritionData);
 * ```
 */

export { NutritionHighlightService } from "./highlights-service";
export { HIGHLIGHT_RULES } from "./rules";
export type {
  NutritionHighlight,
  HighlightRule,
  HighlightLevel,
  HighlightCategory,
  HighlightEngineOptions,
} from "./types";
