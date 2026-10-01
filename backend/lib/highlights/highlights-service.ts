/**
 * Nutritional Highlights Service
 *
 * This is the orchestration layer for the rule-based highlight engine.
 *
 * RESPONSIBILITY:
 * Takes normalized NutritionData and applies deterministic rules to produce
 * 2-5 educational highlights. Every highlight is backed by an explicit,
 * documented threshold (FDA Daily Value, etc.) — not AI-generated.
 *
 * KEY PRINCIPLE:
 * The same NutritionData input ALWAYS produces the same highlights.
 * Determinism is essential for correctness and testability.
 */

import type { NutritionData } from "@/lib/nutrition/types";
import type { NutritionHighlight, HighlightEngineOptions } from "./types";
import { HIGHLIGHT_RULES } from "./rules";

export class NutritionHighlightService {
  /**
   * Default options for highlight generation.
   * These can be overridden per call if needed.
   */
  private readonly defaultOptions: Required<HighlightEngineOptions> = {
    minHighlights: 2,
    maxHighlights: 5,
  };

  /**
   * Generate nutritional highlights from normalized nutrition data.
   *
   * ALGORITHM:
   * 1. Evaluate every rule against the nutrition data
   * 2. Collect all matching highlights (those where rule.evaluate() !== null)
   * 3. Sort by priority (highest first)
   * 4. Slice to [minHighlights, maxHighlights]
   *
   * INVARIANT:
   * - If fewer than minHighlights rules match, return all matches (don't hallucinate)
   * - Never exceed maxHighlights (drop lowest-priority matches)
   * - Identical input → identical output (deterministic)
   *
   * @param data — Normalized nutrition data
   * @param options — Override min/max highlight counts
   * @returns Array of 0-5 highlights, sorted by priority (highest first)
   */
  generateHighlights(
    data: NutritionData,
    options?: HighlightEngineOptions
  ): NutritionHighlight[] {
    const opts = { ...this.defaultOptions, ...options };

    // Step 1: Evaluate every rule
    const allHighlights: NutritionHighlight[] = [];
    for (const rule of HIGHLIGHT_RULES) {
      const highlight = rule.evaluate(data);
      if (highlight !== null) {
        allHighlights.push(highlight);
      }
    }

    // Step 2: Sort by priority (highest first)
    allHighlights.sort((a, b) => b.priority - a.priority);

    // Step 3: Clamp to [minHighlights, maxHighlights]
    // If we have fewer highlights than minHighlights, return what we have
    // (don't invent data). If we have more, keep only the top maxHighlights.
    const start = 0;
    const end = Math.min(allHighlights.length, opts.maxHighlights);
    return allHighlights.slice(start, end);
  }

  /**
   * Count how many rules matched for a given nutrition data.
   * Useful for debugging and understanding why certain highlights appear or don't.
   *
   * @param data — Normalized nutrition data
   * @returns Number of rules that evaluated to non-null
   */
  getMatchingRuleCount(data: NutritionData): number {
    let count = 0;
    for (const rule of HIGHLIGHT_RULES) {
      if (rule.evaluate(data) !== null) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get detailed debug information about which rules matched.
   * For development and troubleshooting only — not exposed to users.
   *
   * @param data — Normalized nutrition data
   * @returns Array of rule IDs that matched
   */
  debugGetMatchedRuleIds(data: NutritionData): string[] {
    return HIGHLIGHT_RULES.filter((rule) => rule.evaluate(data) !== null).map(
      (rule) => rule.id
    );
  }
}
