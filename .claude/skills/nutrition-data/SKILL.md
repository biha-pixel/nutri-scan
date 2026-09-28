---
name: nutrition-data
description: Use when building, modifying, or debugging nutritional data retrieval, food matching, data normalization, or the nutrition provider abstraction. Covers USDA FoodData Central integration, error handling, caching, and teaching data concepts.
---

# Nutrition Data Guide

Guide nutritional data retrieval for the food recognition and nutrition application.

## Core Principle

**Nutrition facts come from authoritative data sources, not from the AI model.** The AI identifies what the food is. The nutrition module looks up that food in a nutrition database and returns verified data. These are two separate steps handled by two separate modules.

## Initial Provider: USDA FoodData Central

- Use the [USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide) as the first nutrition data provider.
- This is a free, public, US government API with extensive food composition data.
- It requires an API key (free to obtain) — store it in a server-side environment variable, never in client code.

### How to Use It

1. Receive a food name from the food recognition module (e.g., "grilled chicken breast").
2. Search the USDA API for matching foods.
3. Select the best match (or present options if ambiguous).
4. Extract the nutritional data from the USDA response.
5. Normalize it into your internal format.

## Internal Nutrition Data Format

Define a consistent internal schema. Do not pass raw USDA responses to the rest of the application.

```typescript
interface NutritionInfo {
  foodName: string;
  servingSize: string;           // "100g", "1 cup (240ml)"
  calories: number;              // kcal
  macronutrients: {
    protein: number;             // grams
    totalFat: number;            // grams
    saturatedFat: number;        // grams
    carbohydrates: number;       // grams
    fiber: number;               // grams
    sugar: number;               // grams
  };
  micronutrients?: {             // optional, include when available
    sodium: number;              // milligrams
    cholesterol: number;         // milligrams
    potassium: number;           // milligrams
    vitaminA?: number;           // micrograms
    vitaminC?: number;           // milligrams
    calcium?: number;            // milligrams
    iron?: number;               // milligrams
  };
  source: string;                // "usda_fdc"
  sourceId: string;              // the USDA FDC ID for traceability
  confidence: "exact" | "close" | "approximate";
}
```

## Data Normalization

Explain these concepts to the user when first implementing this module:

- **Data normalization** — transforming data from an external format (USDA's JSON structure) into your own internal format. Why: so the rest of your code doesn't depend on the USDA API's specific field names and structure.
- **Schema** — the defined shape of your data. Like a contract: "a NutritionInfo object always has these fields with these types."
- **Source of truth** — the authoritative place data comes from. For nutrition data, USDA (not the AI model) is the source of truth.

## Food Matching

Matching an AI-identified food name to a USDA database entry is not trivial:

- The AI might say "grilled chicken breast" but the USDA lists "Chicken, broiler, breast, meat only, cooked, grilled."
- Use the USDA search API and rank the results.
- Consider fuzzy matching or keyword extraction to improve match quality.
- When there are multiple plausible matches, include a confidence level in the response.

## Error Handling

Handle every failure mode explicitly:

| Scenario | What to do |
|---|---|
| **No match found** | Return a clear "no match" result. The app should tell the user and let them search manually or try a different photo. |
| **Ambiguous match** | Return the top candidates with their names and match confidence. Let the user choose. |
| **API error (rate limit, timeout, 5xx)** | Retry with exponential backoff for transient errors. Return a clear error for persistent failures. |
| **Malformed API response** | Validate the response before processing. Log the malformed response for debugging. Return an error, never crash. |
| **Missing nutrient fields** | Some foods don't have all nutrients in the database. Use `null` or `undefined` for missing fields, not zero (zero means "none"; null means "unknown"). |

## Provider Abstraction

Define an interface that any nutrition provider must implement:

```typescript
interface NutritionProvider {
  searchFood(query: string): Promise<NutritionSearchResult[]>;
  getFoodDetails(id: string): Promise<NutritionInfo>;
}
```

- `USDANutritionProvider` implements this interface.
- A future `OpenFoodFactsProvider` or other provider would implement the same interface.
- The rest of the server code depends on the interface, not on USDA directly.

## Caching

Explain caching to the user and apply it:

- **What is caching?** Storing the result of an expensive operation (an API call) so you don't repeat it when the same input comes in again.
- **Why cache here?** The USDA API has rate limits, and the same foods ("chicken breast," "white rice") will be looked up repeatedly.
- **Cache key** — the food search query, normalized (lowercased, trimmed).
- **Cache duration (TTL)** — nutrition data changes slowly. A TTL of 24 hours or longer is reasonable.
- **Where to cache** — start with in-memory caching on the server. Graduate to Redis or a database cache if the server restarts frequently or scales to multiple instances.

## What Not To Do

- Do not let the AI model generate nutrition data. Ever.
- Do not return raw, unnormalized external API responses to the mobile app.
- Do not use zero when a nutrient value is unknown — use null.
- Do not silently swallow API errors — surface them so the user understands what happened.
