# Nutritional Highlights — Teaching Concepts

This document explains six fundamental software engineering concepts using the NutriScan highlights system as a concrete example.

---

## 1. What is Business Logic?

**Definition:** Business logic is the code that encodes the rules, calculations, and decision-making specific to your application's domain. It's the "what this app actually does" layer — distinct from infrastructure (databases, APIs), presentation (UI), or framework glue.

**In NutriScan:**

The highlights system is pure business logic. It answers: "Given nutrition data, what educational statements can we make?"

```typescript
// This IS business logic — a domain-specific rule
if (protein >= 10) {
  return "High in protein";
}

// This is NOT business logic — it's infrastructure
const response = await fetch("https://api.nal.usda.gov/food/123");
```

**Why separate business logic?**

1. **Testability:** You can unit test rules without mocks, databases, or HTTP calls
2. **Portability:** The same logic works in a CLI tool, web API, or mobile app
3. **Maintainability:** Changing "high in protein" to "excellent protein source" is one file, not scattered across API routes, database queries, and UI components
4. **Expert review:** A nutritionist can read `rules.ts` and verify thresholds without understanding React, Next.js, or PostgreSQL

**Where it lives in our architecture:**

```
Mobile App (UI/Presentation)
        ↓
Backend API Routes (HTTP layer)
        ↓
NutritionLookupService (orchestration)
        ↓
NutritionHighlightService (BUSINESS LOGIC) ← Right here
        ↓
Highlight Rules (pure functions, no I/O)
```

Business logic should have **no dependencies on frameworks, databases, or external services**. Our `HIGHLIGHT_RULES` array is just an array of functions that take data and return data.

---

## 2. What is Deterministic Logic?

**Definition:** Deterministic logic produces the exact same output every time for the same input. No randomness, no external state, no "maybe." Given input X, you will always get output Y.

**In NutriScan:**

```typescript
// DETERMINISTIC — same input, same output, always
function evaluateProteinRule(data: NutritionData): NutritionHighlight | null {
  if (data.macronutrients.protein >= 10) {
    return { text: "High in protein", ... };
  }
  return null;
}

// NON-DETERMINISTIC — different output each call
function getRandomHighlight(): string {
  const highlights = ["High in protein", "Low calorie", "Good fiber source"];
  return highlights[Math.floor(Math.random() * highlights.length)];
}
```

**Why does determinism matter?**

1. **Testability:** You can write a test that asserts `evaluate(bananaData)` returns exactly `["High in potassium", "Good source of fiber"]`. That test will pass today, tomorrow, and in five years. Non-deterministic code requires probabilistic testing ("run 1000 times, expect 95% success").

2. **Debugging:** If a user reports "it said 'high in protein' yesterday but not today," you can reproduce the issue by replaying the same input. Non-deterministic bugs are nightmares.

3. **Caching:** Deterministic results can be cached forever. The highlights for FDC ID 173944 (bananas) will never change, so we can store them.

4. **Trust:** Users trust consistent behavior. If the app sometimes says a food is "high in protein" and sometimes doesn't for the same food, users lose confidence.

**What breaks determinism?**

- Current time (`new Date()`)
- Random numbers (`Math.random()`)
- External API calls (the API might return different data)
- User input or UI state
- Database queries (data might change)

Our highlight rules are deterministic because they:
- Don't call APIs
- Don't read the clock
- Don't use random numbers
- Only depend on the `NutritionData` passed to them

---

## 3. What is a Rule Engine?

**Definition:** A rule engine is a system that evaluates a collection of rules against input data to produce outputs. Each rule is an independent condition → action pair. The engine runs all rules, collects matches, and returns the results.

**In NutriScan:**

```
Input: NutritionData (protein: 15g, fiber: 3g, sodium: 50mg)
        ↓
┌─────────────────────────────────────────────────┐
│              RULE ENGINE                         │
│                                                  │
│  Rule 1: protein >= 10?   → "High in protein"   │ ✓ MATCHES
│  Rule 2: protein >= 5?    → "Good protein"      │ ✓ MATCHES (but lower priority)
│  Rule 3: fiber >= 5.6?    → "High fiber"        │ ✗ NO MATCH
│  Rule 4: fiber >= 2.8?    → "Good fiber"        │ ✓ MATCHES
│  Rule 5: sodium <= 140?   → "Low sodium"        │ ✓ MATCHES
│  ...                                             │
└─────────────────────────────────────────────────┘
        ↓
Output: ["High in protein", "Good source of fiber", "Low in sodium"]
        (sorted by priority, limited to max 5)
```

**Why use a rule engine pattern?**

1. **Extensibility:** Adding a new highlight rule is adding one object to an array. No `if/else` chain to modify, no switch statement to expand.

2. **Testability:** Each rule is a pure function. Test it in isolation:

```typescript
it('triggers "protein_high" when protein >= 10g', () => {
  const result = proteinHighRule.evaluate({ protein: 10, ... });
  expect(result).not.toBeNull();
});
```

3. **Transparency:** All rules are visible in one file. A domain expert (nutritionist) can review them without being a programmer.

4. **Priority management:** Rules have explicit priorities. When multiple rules match, we know which ones to show first.

**Alternative approaches:**

- **Monolithic function:** One giant `if/else` chain. Works, but hard to extend and test in isolation.
- **Database-driven rules:** Store thresholds in a database. Flexible, but adds complexity and latency.
- **Machine learning:** Train a model to predict highlights. Overkill, non-deterministic, and unexplainable.

For our use case, a simple array of rule functions is the right balance of simplicity and extensibility.

---

## 4. Why Should Some Logic NOT Be Generated by LLMs?

**The question:** Why not just ask an AI model to generate highlights from nutrition data? Why build a rule engine?

**Answer:** Because LLMs are **probabilistic**, not deterministic. They generate plausible text, not verified facts.

**The risks of LLM-generated highlights:**

### 1. Hallucination (Making Things Up)

```
LLM Input: "Generate nutritional highlights for a banana."

LLM Output: "Bananas are high in potassium, which supports heart health and 
may reduce the risk of stroke."

Problem: "may reduce the risk of stroke" is a MEDICAL CLAIM. We explicitly 
cannot make medical claims. The LLM invented this — it's not in the nutrition data.
```

### 2. Inconsistency

```
Query 1: "What highlights for protein: 15g?"
Output: "Excellent source of protein"

Query 2: "What highlights for protein: 15g?"
Output: "High protein content"

Query 3: "What highlights for protein: 15g?"
Output: "Good source of protein"

Problem: Same input, different outputs. Users see inconsistent information.
```

### 3. Threshold Drift

```
LLM Input: "Is 9g protein considered high?"

Output A: "Yes, 9g is a significant amount."
Output B: "No, 9g is moderate."
Output C: "It depends on your daily needs."

Problem: The FDA defines "high" as >= 20% DV (10g). The LLM doesn't know this 
or might apply it inconsistently.
```

### 4. No Audit Trail

With a rule engine:
- Every highlight cites its source: `referenceBasis: "FDA 21 CFR 101.54"`
- A regulator or user can verify the threshold
- If the FDA updates thresholds, we update one constant

With LLM output:
- No way to verify why the LLM said "high in protein"
- No regulatory traceability
- No way to systematically update knowledge

### 5. Regulatory Liability

If an LLM incorrectly says a food is "low sodium" when it has 500mg sodium, and a user on a sodium-restricted diet relies on that information, the app could face legal consequences.

**When to use LLMs:**

- Food identification from images (probabilistic, but we surface uncertainty)
- Natural language search ("find high-protein breakfast foods")
- Summarizing or explaining concepts

**When NOT to use LLMs:**

- Threshold-based claims that must be accurate and verifiable
- Regulatory compliance (FDA definitions, Daily Value percentages)
- Medical or health claims (even if unintentional)

---

## 5. What is Derived Data?

**Definition:** Derived data is data computed from other data. It's not stored directly; it's calculated on-demand or cached from source data.

**In NutriScan:**

```
SOURCE DATA (from USDA API):
{
  protein: 15,
  fiber: 3,
  vitaminC: 20,
  ...
}

DERIVED DATA (highlights):
[
  { text: "High in protein", referenceBasis: "FDA 21 CFR 101.54" },
  { text: "Good source of fiber", referenceBasis: "FDA 21 CFR 101.54" }
]
```

The highlights are **derived** from the nutrition data. They don't exist in the USDA database. We compute them.

**Why derive instead of store?**

### Option A: Store highlights in the database

```sql
-- foods table
id | name     | protein | fiber | highlight_1      | highlight_2
1  | Banana   | 1.09    | 2.6   | "Good fiber"     | "Low calorie"
```

Problems:
- If FDA updates thresholds, all stored highlights become stale
- Highlights depend on serving size; we'd need to recompute for different servings
- Storage overhead (storing text strings for every food)

### Option B: Derive highlights on-demand

```typescript
function getHighlights(food: NutritionData): NutritionHighlight[] {
  return HIGHLIGHT_RULES
    .map(rule => rule.evaluate(food))
    .filter(notNull)
    .sort(byPriority)
    .slice(0, 5);
}
```

Benefits:
- Thresholds are code; update once, all foods reflect the change
- Serving size variations handled automatically (rules operate on the data provided)
- No storage overhead
- Source of truth is the rule, not a stored string

**Derived data is a function of source data:**

```
Highlights = f(NutritionData)
```

This is the core insight. The highlights don't need their own database table because they can always be recomputed from the nutrition data.

**When to store derived data:**

- Computation is expensive (complex ML inference)
- Latency matters (precompute for fast reads)
- Source data rarely changes

For us, evaluating 20 rules against a few numbers takes microseconds. No need to cache.

---

## 6. Why Can the Same Data Have Different Presentation Layers?

**Definition:** Presentation layer is how data is displayed to users. The same underlying data can be presented differently based on context, user preferences, device constraints, or platform conventions.

**In NutriScan:**

The same `NutritionData` and `NutritionHighlight[]` can be presented in multiple ways:

### Presentation A: Mobile App Summary Card

```
┌─────────────────────────────┐
│ 🍌 Bananas, raw             │
│                             │
│ ⭐ Nutritional Highlights   │
│ • High in potassium         │
│ • Good source of fiber      │
│ • Low in sodium             │
│                             │
│ 89 cal • 1g protein         │
└─────────────────────────────┘
```

### Presentation B: Detailed Nutrition Screen

```
Bananas, raw (1 medium, 118g)

NUTRITIONAL HIGHLIGHTS

High in potassium
Contains 358mg potassium (>= 20% of Daily Value).
Reference: FDA 21 CFR 101.54 (>= 20% DV = 940mg)

Good source of dietary fiber
Provides 2.6g dietary fiber (10-19% of Daily Value).
Reference: FDA 21 CFR 101.54 (10-19% DV = 2.8-5.5g)

Low in sodium
Contains 1mg sodium (<= 140mg per serving).
Reference: FDA 21 CFR 101.61 (<= 140mg per serving)
```

### Presentation C: Voice Assistant

```
User: "What are the nutritional highlights of a banana?"
Voice: "Bananas are high in potassium and a good source of 
dietary fiber, with low sodium content."
```

### Presentation D: Accessibility (Screen Reader)

```html
<dl>
  <dt>Nutritional Highlight</dt>
  <dd>High in potassium: Contains 358mg potassium, 
      which is at least 20% of the Daily Value.</dd>
  
  <dt>Regulatory Reference</dt>
  <dd>FDA 21 CFR 101.54 defines "high" as 20% or more 
      of the Daily Value per serving.</dd>
</dl>
```

**Why separate data from presentation?**

1. **Platform diversity:** Mobile app, web dashboard, voice skill, smartwatch — same data, different displays
2. **Accessibility:** Screen readers need semantic HTML; visual users want cards and icons
3. **Personalization:** Some users want detailed scientific references; others want quick summaries
4. **Internationalization:** Same data, different languages, number formats, or cultural contexts
5. **A/B testing:** Try different presentations without changing business logic

**In our architecture:**

```
NutritionData (raw numbers)
        ↓
NutritionHighlightService (business logic)
        ↓
NutritionHighlight[] (derived data)
        ↓
┌─────────────┬─────────────┬─────────────┐
│ Mobile Card │ Detail View │ Voice Skill │
│ (React      │ (Detailed   │ (Plain      │
│  Native)    │  Text)      │  Speech)    │
└─────────────┴─────────────┴─────────────┘
      Presentation Layer (many forms)
```

The business logic doesn't know or care how highlights are displayed. It just returns structured data (`{ text, description, referenceBasis }`). The presentation layer decides whether to show the `referenceBasis`, how to format the `description`, whether to use icons, etc.

**Key principle:** Data is immutable facts. Presentation is a choice.

---

## Summary Table

| Concept | Definition | In NutriScan |
|---------|------------|--------------|
| **Business Logic** | Domain-specific rules and calculations | Highlight rules: "protein >= 10 → high" |
| **Deterministic** | Same input → same output, always | Rules are pure functions with no external state |
| **Rule Engine** | System evaluating independent rules | `HIGHLIGHT_RULES` array, each rule is a predicate |
| **Not LLM-Generated** | LLMs are probabilistic, not verifiable | Thresholds cite FDA regulations; LLMs can hallucinate |
| **Derived Data** | Computed from source data | Highlights derived from NutritionData on-demand |
| **Presentation Layer** | How data is displayed | Mobile card, detail view, voice, accessibility — same data |

---

## Files in the Highlights Module

| File | Responsibility |
|------|----------------|
| `types.ts` | Domain model: `NutritionHighlight`, `HighlightRule`, `HighlightLevel` |
| `rules.ts` | Business logic: all threshold-based highlight rules with FDA references |
| `highlights-service.ts` | Orchestration: evaluate rules, sort by priority, limit to max |
| `__tests__/highlights-service.test.ts` | Test coverage: 42 tests for all rules and edge cases |
| `index.ts` | Public API: export service and types |

---

## Next Steps

The highlights system is complete and tested. To integrate it into the API:

1. **Option A:** Add highlights to the `/api/nutrition/lookup` response
   - After fetching nutrition data, generate highlights inline
   - Return `{ nutritionData, highlights }` in one response

2. **Option B:** Create a dedicated `/api/nutrition/highlights` endpoint
   - Client sends nutrition data, server returns highlights
   - Useful if client already has nutrition data cached

The business logic is independent of this decision — it's just a function call.
