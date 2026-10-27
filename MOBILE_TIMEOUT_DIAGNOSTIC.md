# Mobile Timeout Diagnostic Report

## Problem Statement
- **Backend:** Successfully processes requests, returns HTTP 200 with food detection results
- **Response Time:** 7-39 seconds per request (Gemini API calls are slow)
- **Mobile App:** Shows "no food detected. image is unavailable or could not be processed."
- **This Error Comes From:** `analysis.tsx` lines 148-157 when `result.items.length === 0` or `result.imageQuality === 'unrecognizable'`

## Root Cause Analysis

The backend IS returning HTTP 200, but the mobile is showing an error that means the backend returned:
- `items: []` (empty food array), OR
- `imageQuality: "unrecognizable"`, OR
- Response never arrived (timeout/abort)

## Hypothesis: Response Timeout

The Expo File API upload has a **default timeout** that may be firing before the backend sends the response.

### Evidence:
1. Backend logs show requests take 7-39 seconds
2. Mobile never receives the response
3. The vision service timeout would result in a try/catch that shows the actual error in logs
4. Instead, we see a "no food detected" error, which is the app's handling of an empty response

## Solution: Increase Upload Timeout

The Expo File API `tempUploadFile.upload()` method doesn't expose a timeout option directly, but we can:

1. **Wrap the upload in a Promise timeout** that throws a clearer error
2. **Add comprehensive logging** to track where the response breaks
3. **Handle slow Gemini API calls** by increasing backend timeout expectations

## Recommended Fixes

### 1. Add Response Timeout Handling (analyze-service.ts)
```typescript
const uploadPromise = tempUploadFile.upload(...);
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Upload timeout after 120s')), 120000)
);

const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);
```

### 2. Increase Gemini Retry Patience (gemini-provider.ts)
- The vision provider already retries, but with exponential backoff
- Ensure retries give Gemini enough time

### 3. Add Real-Time Progress Logging
- Log when upload starts/completes on mobile
- Log when response arrives on mobile
- Log response parsing start/complete

## Implementation Plan

1. **Wrap upload in explicit timeout** (120 seconds)
2. **Add detailed response logging** to see where it breaks
3. **Test with a real image** to see actual timing
4. **Monitor backend logs** to correlate with mobile logs

## Next Step
Implement timeout wrapper and detailed logging, then test again with a food image in Expo Go.
