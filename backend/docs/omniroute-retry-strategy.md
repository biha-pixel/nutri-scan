# OmniRoute Retry Strategy

## Problem

OmniRoute routes requests to a pool of AI models (Gemini, Claude, GPT, Grok, etc.). Individual models can fail for several reasons:

1. **Model quota exceeded** — OmniRoute returns a text error instead of routing to the next model
2. **Model unavailable** — The selected model is temporarily down
3. **Non-vision model selected** — Some models in a generic combo might not support vision
4. **Invalid response** — The model returns text instead of the requested JSON schema
5. **Transient network issues** — Connection drops or timeouts

Without retry logic, any single failure would return an error to the user, even though other models in the pool might work.

---

## Solution: Retry with Exponential Backoff

The `GeminiVisionProvider` now automatically retries failed requests up to **5 times** (configurable). Each retry gives OmniRoute another chance to route to a different, working model.

### How It Works

```
Attempt 1: Call OmniRoute → Model A fails (quota exceeded)
           Wait 1 second
Attempt 2: Call OmniRoute → Model B fails (invalid JSON)
           Wait 2 seconds
Attempt 3: Call OmniRoute → Model C succeeds ✅
           Return result immediately
```

**Exponential backoff** prevents hammering the server:
- Attempt 1 → Attempt 2: wait 1 second
- Attempt 2 → Attempt 3: wait 2 seconds
- Attempt 3 → Attempt 4: wait 4 seconds
- Attempt 4 → Attempt 5: wait 8 seconds

This gives OmniRoute's internal routing logic time to select a different model.

---

## Configuration

Set these in `backend/.env.local`:

```bash
# Required
OMNIROUTE_API_KEY=your-omniroute-api-key
OMNIROUTE_BASE_URL=http://localhost:20128
OMNIROUTE_MODEL=gemini

# Optional retry configuration
OMNIROUTE_MAX_RETRIES=5        # Default: 5 attempts before giving up
OMNIROUTE_RETRY_DELAY=1000     # Default: 1000ms base delay
```

### Why These Defaults?

- **5 retries** — With a diverse model pool (Gemini, Claude, GPT, Grok, Llama, etc.), 5 attempts should hit at least one working model
- **1000ms base delay** — Gives OmniRoute time to route to a different model without making the user wait too long
- **Exponential backoff** — Total max wait time: 1s + 2s + 4s + 8s = **15 seconds** across all retries

---

## What Gets Retried

The provider retries when:

1. **API errors** — OmniRoute returns an error (network, auth, rate limit)
2. **No response content** — The model returns empty content
3. **Invalid JSON** — The response cannot be parsed as JSON
4. **Schema validation fails** — The JSON doesn't match our `FoodRecognitionResult` schema
5. **Model unavailable messages** — OmniRoute returns a text error like "Model X is unavailable"

### What Does NOT Get Retried

- **Valid JSON response** — Even if it says "no food detected", that's a successful response
- **Valid empty items array** — A legitimate result (e.g., image contains no food)

---

## Logging

The provider logs each attempt for debugging:

```
[VisionProvider] Attempt 1/5 calling model "gemini"...
[VisionProvider] Attempt 1/5 failed: No valid JSON found in AI response
[VisionProvider] Waiting 1000ms before next attempt (allows OmniRoute model rotation)...
[VisionProvider] Attempt 2/5 calling model "gemini"...
[VisionProvider] Attempt 2 succeeded.
```

In production, you can filter these logs by `[VisionProvider]`.

---

## Trade-offs

### ✅ Pros
- **High availability** — One failed model doesn't break the entire service
- **Automatic failover** — No manual intervention needed
- **Better user experience** — Most requests succeed eventually
- **Works with any combo** — Doesn't matter which models you add to OmniRoute

### ⚠️ Cons
- **Increased latency** — Failed attempts add 1-15 seconds (only when models fail)
- **Higher costs** — Retries consume additional API quota (only on failures)
- **Request timeout** — Next.js API routes have a default 60-second timeout; with 5 retries taking ~20s each, you might hit this limit (consider reducing `MAX_RETRIES` to 3 for very slow models)

---

## When to Adjust

### Reduce retries (e.g., 3 attempts)
- Your OmniRoute pool is small (1-2 models)
- You need faster failures
- You're hitting Next.js timeout limits

### Increase retries (e.g., 7 attempts)
- You have a very large model pool (10+ models)
- You prioritize success over speed
- Most models in your pool are unreliable

### Reduce delay (e.g., 500ms)
- You want faster responses
- Your OmniRoute routes instantly

### Increase delay (e.g., 2000ms)
- OmniRoute needs more time to route between models
- You're seeing back-to-back failures to the same model

---

## Testing

To test the retry logic:

1. Start the dev server: `npm run dev` (in `backend/`)
2. Send a food image to `/api/scan`
3. Watch the server logs for retry attempts
4. If you see multiple attempts before success, the retry logic is working

To simulate failures:
- Temporarily set `OMNIROUTE_MODEL` to a non-existent model name
- The provider will retry 5 times before giving up
- You should see all 5 attempts in the logs

---

## Code Location

- **Provider implementation**: `backend/lib/food/gemini-provider.ts`
- **Route handler configuration**: `backend/app/api/scan/route.ts`
- **Environment variables**: `backend/.env.local` and `backend/.env.example`
