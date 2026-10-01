import { describe, it, expect } from "vitest";
import { USDANutritionProvider } from "@/lib/nutrition/usda-provider";
import { NutritionLookupService } from "@/lib/nutrition/nutrition-service";

describe("Live USDA API Key Verification", () => {
  const apiKey = process.env.USDA_API_KEY || "puzQ2wMVShwGfuzfdLmMdxvVjZOlQtoAN2BvMopr";
  const provider = new USDANutritionProvider(apiKey);
  const service = new NutritionLookupService(provider);

  it("successfully connects to USDA API and fetches search results", async () => {
    const results = await provider.searchFoods("cheddar cheese");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].foodName).toBeDefined();
    console.log("Top USDA Search Result:", results[0]);
  }, 10000);

  it("successfully looks up full nutrition details through service", async () => {
    const result = await service.lookupNutrition("apple");
    expect(result.success).toBe(true);
    if (result.success) {
      console.log("Live Lookup Result for Apple:", {
        foodName: result.data.foodName,
        serving: `${result.data.servingSize} ${result.data.servingUnit}`,
        calories: result.data.calories,
        protein: result.data.macronutrients.protein,
        carbs: result.data.macronutrients.carbohydrates,
        fat: result.data.macronutrients.totalFat,
        matchConfidence: result.data.matchConfidence,
      });
      expect(result.data.calories).toBeGreaterThan(0);
    }
  }, 10000);
});
