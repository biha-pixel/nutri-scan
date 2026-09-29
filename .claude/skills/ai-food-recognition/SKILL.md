---
name: ai-food-recognition
description: Use when building, modifying, or debugging the food image recognition system. Covers AI provider integration, structured output, confidence handling, API key security, and the provider abstraction layer.
---

# AI Food Recognition Guide

Guide the food image recognition system for the nutrition application.

## Core Principles

1. **The AI identifies food — it does not provide nutrition facts.** The AI model identifies food items in the image and returns their names/portions. Nutritional data comes from a trusted, authoritative source (USDA). Never let the AI generate calorie counts, macros, or any nutrition data.
2. **Never expose AI API keys to the client.** The mobile app sends images to the Next.js backend. The server calls the AI provider. API keys live in server-side environment variables, never client-side code.
3. **Provider abstraction.** Use an interface (`FoodRecognitionProvider`) so the AI provider (e.g., Gemini) can be swapped easily.

## Gemini Multimodal API Integration
- Use Gemini for multimodal (vision) input.
- Use a prompt asking for structured JSON output.
- Validate the AI response with **Zod** — never trust that the model followed the schema.

### Structured JSON Output
Use this defined internal schema for food recognition results:

```typescript
interface FoodRecognitionResult {
  items: FoodItem[];
  imageQuality: "good" | "poor" | "unrecognizable";
}

interface FoodItem {
  name: string;
  category: string;
  estimatedPortion: string;
  confidence: number;              // 0.0 to 1.0
  alternativeNames: string[];
}
```

## Confidence and Uncertainty
- Always include a confidence score for each identified food item.
- Provide alternative identifications when confidence is low.
- Set a threshold below which the app asks the user to confirm/correct identification.
- **Surface uncertainty explicitly** to the user: "I think it is X, but I am not certain" is required.

## Provider Abstraction
Implement this interface:

```typescript
interface FoodRecognitionProvider {
  identifyFood(image: Buffer, mimeType: string): Promise<FoodRecognitionResult>;
}
```

The rest of the backend code depends on `FoodRecognitionProvider`, not `GeminiFoodRecognitionProvider`.

## Teaching AI Concepts
When implementing, explain:
- **Multimodal model** — AI processing both text and images.
- **Prompt engineering** — Instructions that produce reliable/structured output.
- **Structured output** — Getting JSON back from the model.
- **Confidence score** — Certainty level.
- **Hallucination** — Why we never let AI generate nutrition facts.
- **Provider abstraction** — Why we separate the interface from the implementation.

## Error Handling
- Handle API errors (rate limits, timeouts) and model errors (malformed schema, empty identification).
- Return clear error types.
- Never crash on AI responses — validate, log, return an error.
