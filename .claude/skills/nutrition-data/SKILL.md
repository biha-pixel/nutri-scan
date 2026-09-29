---
name: nutrition-data
description: Use when building, modifying, or debugging nutritional data retrieval, food matching, data normalization, or the nutrition provider abstraction. Covers USDA FoodData Central integration, error handling, caching, and teaching data concepts.
---

# Nutrition Data Guide

Guide nutritional data retrieval for the food recognition and nutrition application.

## Core Principle

**Nutrition facts come from authoritative data sources, not from the AI model.** The AI identifies food. The nutrition module looks up that food in a verified database (USDA). These are two separate modules.

## Initial Provider: USDA FoodData Central
- Use the [USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide).
- Store the API key in a server-side environment variable. Never in client code.

## Internal Nutrition Data Format
Define a consistent internal schema. **Do not pass raw USDA responses to the mobile app.**

```typescript
interface NutritionInfo {
  foodName: string;
  servingSize: string;
  calories: number;              // kcal
  macronutrients: {
    protein: number;             // grams
    totalFat: number;            // grams
    saturatedFat: number;        // grams
    carbohydrates: number;       // grams
    fiber: number;               // grams
    sugar: number;               // grams
  };
  micronutrients?: {
    sodium: number;              // milligrams
    cholesterol: number;         // milligrams
    potassium: number;           // milligrams
    vitaminA?: number;           // micrograms
    vitaminC?: number;           // milligrams
    calcium?: number;            // milligrams
    iron?: number;               // milligrams
  };
  source: string;                // "usda_fdc"
  sourceId: string;
  confidence: "exact" | "close" | "approximate";
}
```

## Data Concepts to Teach
- **Data normalization** — Transforming external data (USDA's structure) into your internal format (`NutritionInfo`).
- **Schema** — The contract of what data looks like.
- **Source of truth** — USDA (not the AI model) is the source of truth for nutrition.
- **Caching** — Storing API call results to avoid redundant, expensive lookups.
- **TTL (Time-To-Live)** — Expiration time for cached data.
- **Null vs Zero** — Use `null`/`undefined` for unknown nutrient values, not `0`.

## Food Matching & Errors
- Use the USDA search API and rank results. Handle ambiguous matches (return candidates) and no matches gracefully.
- Handle retries (exponential backoff) for API errors.
- Validate API responses with **Zod** before processing.

## Provider Abstraction
Implement this interface:

```typescript
interface NutritionProvider {
  searchFood(query: string): Promise<NutritionSearchResult[]>;
  getFoodDetails(id: string): Promise<NutritionInfo>;
}
```

The rest of the backend depends on this interface, not the `USDANutritionProvider`.

## Future Providers
- Add Open Food Facts later for packaged products/barcodes.

## Prohibited
- Do not let the AI model generate nutrition data.
- Do not return raw external API responses.
- Do not use zero for unknown nutrient values — use null.
