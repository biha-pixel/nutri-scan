---
name: testing-review
description: Use when writing tests, reviewing test coverage, or after making code changes that should be tested. Covers unit tests, integration tests, mocking AI providers, testing nutrition data normalization, food matching, API validation, and multi-food scenarios.
---

# Testing Review Guide

Ensure changes to the food recognition and nutrition application are properly tested.

## Testing Philosophy
- **Test behavior, not implementation.**
- **Every test must have a purpose.**
- **Test the things that break:** complex logic, data transformations, error handling, boundaries.

## Test Types
- **Unit Tests:** Individual functions/modules (normalization, matching). Fast, no deps.
- **Integration Tests:** Interaction between modules (server route cycle). Uses mocks.

## Testing Specific Areas
- **AI Provider Code (Mocks):** Mock the `FoodRecognitionProvider` interface. Do not call real APIs.
- **Nutrition Data Normalization:** Test transformations (`NutritionInfo` schema).
- **Food Matching:** Test match logic, ambiguous/no matches.
- **API Validation:** Test Zod schema validation (input types, file validation).
- **Multi-Food Scenarios:** Test multi-item results correctly processed individually.

## Test Error Cases
- Network unavailable
- External API errors
- Invalid/malformed input
- Missing required fields
- Server does not crash on malformed requests

## Explaining Tests
Briefly explain:
1. **What** this test verifies.
2. **Why** it matters.
3. **How** the test works (especially mocks).

## After Code Changes
1. **Run existing tests**.
2. **Write new tests** for new behavior (happy + error paths).
3. **Run type checks** (`tsc --noEmit`).
4. **Run linter**.
5. **Report results** (do not silently skip).

## Test Organization
```
__tests__/
  unit/
    normalization.test.ts       # nutrition data normalization
    foodMatching.test.ts        # food matching logic
  integration/
    scanFlow.test.ts            # full scan flow with mocks
  mocks/                        # mock implementations
```
