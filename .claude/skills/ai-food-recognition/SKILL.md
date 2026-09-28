---
name: ai-food-recognition
description: Use when building, modifying, or debugging the food image recognition system. Covers AI provider integration, structured output, confidence handling, API key security, and the provider abstraction layer.
---

# AI Food Recognition Guide

Guide the food image recognition system for the nutrition application.

## Core Principles

1. **The AI identifies food — it does not provide nutrition facts.** The AI model's job is to look at an image and say "this is grilled chicken, rice, and broccoli." Nutritional data comes from a separate, authoritative source (USDA FoodData Central). Never let the AI model generate calorie counts, macronutrient values, or any nutritional data.

2. **Never expose AI API keys to the mobile app.** The mobile app sends images to *your* backend server. The server calls the AI provider. API keys live in server-side environment variables, never in client-side code, never in the JavaScript bundle, never in a config file that ships to the phone.

3. **Keep the AI provider behind an abstraction** so it can be replaced without rewriting the rest of the system.

## Initial Provider: Gemini Multimodal API

- Use Google's Gemini API with multimodal (vision) capabilities as the first provider.
- Send the food image to Gemini and ask it to identify the food items.
- Use a well-crafted prompt that asks for structured output.

### Prompt Design

The prompt to the AI model should:
- Ask the model to identify all visible food items in the image.
- Request structured JSON output with a defined schema.
- Ask for the model's confidence/uncertainty for each item.
- Instruct the model to say "I'm not sure" or "I cannot identify this" rather than guessing.
- Never ask for nutritional information.

### Structured JSON Output

Define a clear schema for the AI response. Example shape:

```typescript
interface FoodRecognitionResult {
  items: FoodItem[];
  imageQuality: "good" | "poor" | "unrecognizable";
}

interface FoodItem {
  name: string;                    // "grilled chicken breast"
  category: string;                // "protein", "grain", "vegetable", etc.
  estimatedPortion: string;        // "about 1 cup", "1 medium piece"
  confidence: number;              // 0.0 to 1.0
  alternativeNames: string[];      // other things it might be
}
```

Use the AI provider's structured output / JSON mode feature when available. Always validate the response against the schema — do not trust that the model returned valid JSON or followed the schema.

## Multiple Food Items

- A single image often contains multiple foods (a plate with chicken, rice, and salad).
- The AI must identify each item separately.
- The downstream nutrition lookup processes each item independently.

## Confidence and Uncertainty

- Include a confidence score for each identified food item.
- Provide alternative identifications when confidence is low.
- Set a threshold below which the app asks the user to confirm or correct the identification.
- Be transparent with the user: "I think this is X, but I'm not sure" is better than a wrong answer presented as fact.

## Provider Abstraction

Define an interface that any vision provider must implement:

```typescript
interface FoodRecognitionProvider {
  identifyFood(image: Buffer, mimeType: string): Promise<FoodRecognitionResult>;
}
```

- The `GeminiFoodRecognitionProvider` implements this interface.
- A future `OpenAIFoodRecognitionProvider` or `CustomModelProvider` would implement the same interface.
- The rest of the server code depends on the interface, not on Gemini directly.
- Explain to the user why this abstraction exists and how it works.

## AI Concepts to Teach

When relevant, explain these concepts to the user (they are a beginner CSE student):

- **Multimodal model** — an AI model that can process both text and images (and sometimes audio/video).
- **Prompt engineering** — writing instructions to the model that produce reliable, structured output.
- **Structured output / JSON mode** — asking the model to respond in a specific format so your code can parse it.
- **Confidence score** — how certain the model is about its answer. A number, not a guarantee.
- **Hallucination** — when the model generates plausible-sounding but incorrect information. This is why we never let the AI provide nutrition facts.
- **Provider abstraction** — a code pattern that lets you swap one AI service for another without changing the rest of your application.

## Error Handling

- Handle API errors: rate limits, timeouts, authentication failures, malformed responses.
- Handle model errors: response doesn't match schema, empty response, refusal to answer.
- Return clear error types to the caller so the mobile app can show appropriate messages.
- Never crash on an unexpected AI response — validate, log, and return an error.
