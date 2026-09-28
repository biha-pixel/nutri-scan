---
name: testing-review
description: Use when writing tests, reviewing test coverage, or after making code changes that should be tested. Covers unit tests, integration tests, mocking AI providers, testing nutrition data normalization, food matching, API validation, and multi-food scenarios.
---

# Testing Review Guide

Ensure changes to the food recognition and nutrition application are properly tested.

## Testing Philosophy

- **Test behavior, not implementation.** A test should verify what the code does, not how it does it internally. If you refactor the internals and the behavior stays the same, the test should still pass.
- **Every test should have a clear purpose.** Before writing a test, state in a comment or test name what behavior it is verifying. If you can't explain the purpose, the test is probably not useful.
- **Test the things that break.** Focus testing effort on: complex logic, data transformations, error handling, and integration boundaries.
- **Meaningless assertions waste time.** `expect(true).toBe(true)` or `expect(component).toBeDefined()` without checking actual behavior are not real tests. Every assertion should verify something the user or the system depends on.

## Test Types

### Unit Tests
- Test individual functions and modules in isolation.
- Fast, focused, no external dependencies.
- Examples in this project:
  - Nutrition data normalization (USDA response → internal format)
  - Food name matching logic
  - Confidence score thresholds
  - Input validation functions
  - Utility functions

### Integration Tests
- Test how modules work together.
- May use a test database, mock external APIs, or test full request/response cycles.
- Examples in this project:
  - Server endpoint receives an image and returns nutrition data (mocked AI + mocked USDA)
  - Food recognition result flows into nutrition lookup
  - Full scan flow with mocked external services

### What Not to Test (initially)
- Trivial getters/setters
- Framework code (React Native rendering internals, Expo SDK internals)
- Third-party library internals
- Styling / visual layout (that's what manual testing and visual review are for)

## Testing Specific Areas

### AI Provider Code (Mocking)

The AI provider (Gemini) is an external service. Do not call the real API in tests.

- **Mock the provider at the interface level.** Since there's a `FoodRecognitionProvider` interface, create a mock implementation for tests.
- Test that your code correctly handles:
  - A successful response with multiple food items
  - A response with low-confidence items
  - A response where the model says "I can't identify this"
  - An invalid/malformed response that doesn't match the expected schema
  - API errors (timeout, rate limit, auth failure)
  - An empty image or unsupported format

```typescript
// Example: mock provider for tests
const mockProvider: FoodRecognitionProvider = {
  identifyFood: jest.fn().mockResolvedValue({
    items: [
      { name: "grilled chicken", confidence: 0.95, ... },
      { name: "white rice", confidence: 0.88, ... },
    ],
    imageQuality: "good",
  }),
};
```

Explain to the user:
> *Mocking means creating a fake version of something for testing. We mock the Gemini API so our tests don't actually call Google's servers — they run instantly, don't cost money, and work without an internet connection.*

### Nutrition Data Normalization

Test the transformation from external format to internal format:

- USDA response with all fields present → correct internal format
- USDA response with missing nutrient fields → nulls (not zeros) in internal format
- USDA response with unexpected units → correct conversion
- Multiple search results → correct ranking/selection
- Empty search results → proper "no match" response

### Food Matching

- Exact match: "chicken breast" → finds "Chicken, breast, meat only"
- Partial match: "grilled chicken" → finds chicken entries, ranked by relevance
- No match: "xyzfoodthatdoesntexist" → returns no results gracefully
- Ambiguous match: "chicken" → returns multiple candidates with confidence scores

### API Validation

- Valid image upload → accepted
- Oversized image → rejected with clear error
- Wrong file type → rejected with clear error
- Missing required fields → rejected with specific validation error
- Malformed request body → rejected, server does not crash

### Multi-Food Scenarios

- Image with one food item → single nutrition result
- Image with three food items → three separate nutrition lookups, all returned
- Image with one recognized and one unrecognized food → partial results with clear indication of what couldn't be identified
- Image with duplicate foods → handled correctly (two servings of rice)

## Test Error Cases

For every feature, explicitly test:

- What happens when the network is unavailable?
- What happens when the external API returns an error?
- What happens when the input is invalid?
- What happens when the response is malformed?
- What happens when a required field is missing?

> *Error case tests are often more valuable than happy-path tests. The happy path usually works because you wrote the code to make it work. Errors are where bugs hide — in the paths you didn't think about.*

## Explaining Tests to the User

When writing a test, briefly explain:
1. **What** this test verifies (the behavior)
2. **Why** it matters (what could go wrong if this behavior broke)
3. **How** the test works (for non-obvious setups like mocks)

## After Code Changes

After making code changes, do the following:

1. **Run existing tests** — verify nothing broke.
2. **Write new tests** for new behavior — cover the happy path and at least the most likely error cases.
3. **Run type checks** (`tsc --noEmit` or equivalent) — catch type errors early.
4. **Run the linter** (`eslint` or equivalent) — catch style and potential issues.
5. **Report the results** — if anything fails, say so clearly. Do not silently skip failing tests.

## Test Organization

```
__tests__/                      # or tests/ or colocated .test.ts files
  unit/
    normalization.test.ts       # nutrition data normalization
    foodMatching.test.ts        # food name matching
    validation.test.ts          # input validation
  integration/
    scanFlow.test.ts            # full scan flow with mocks
    nutritionLookup.test.ts     # food recognition → nutrition lookup
  mocks/
    mockFoodRecognitionProvider.ts
    mockNutritionProvider.ts
    fixtures/                   # sample API responses
      usdaSearchResponse.json
      geminiResponse.json
```
