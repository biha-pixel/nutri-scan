# API 400 Error Analysis & Fix Plan

## Root Causes Identified

### 1. **Native Upload Path Issue** (analyze-service.ts line 196-202)
**Problem:** The Expo File API `tempUploadFile.upload()` does NOT automatically set the file's MIME type in the multipart form correctly for all scenarios. The backend receives:
- File name: might be `blob` or a temp name without extension
- File type in form: may be missing or generic
- Magic bytes validation: rejects if not valid image

**Evidence:** 
- Console shows 400 BEFORE `[analyze-food] Analyzing image with VisionProvider...`
- This means the error occurs during validation (lines 236-254 in route.ts)
- ImageUploadSchema validates both `name` and `type`

### 2. **ImageUploadSchema MIME Type Validation** (schemas.ts line 39-48)
**Problem:** The schema's `.refine()` on line 45 is too strict - it calls `.toLowerCase()` on the type, but if type is `undefined` or empty, calling methods on it will fail during parsing.

### 3. **Missing Error Details in Mobile** (analyze-service.ts line 206-211)
**Problem:** When native upload returns HTTP 400, the error response body is not parsed:
```typescript
if (uploadResult.status < 200 || uploadResult.status >= 300) {
  throw new AnalyzeServiceError(
    `Server returned status ${uploadResult.status}. Please try again.`, // Generic!
    'HTTP_ERROR',
    { status: uploadResult.status, body: uploadResult.body }
  );
}
```

The backend is returning structured `{ success: false, error: { code, message } }` but analyze-service.ts is not parsing it.

### 4. **Graceful Metadata Fallback Already Implemented** ✓
Backend code (lines 286-291) already gracefully handles bad metadata - proceeds without it. Good!

### 5. **GET /api/scans Polling** 
Dependency issue in history.tsx: `loadHistory` dependency array includes `offset` (line 87), causing re-runs when offset changes. This creates infinite poll loop.

---

## Fixes Required

1. ✅ Add detailed error logging to backend 400 responses
2. ✅ Parse server error body in native upload path (analyze-service.ts)
3. ✅ Fix schema type validation to handle undefined/empty
4. ✅ Fix history.tsx polling dependency
5. ✅ Run TypeScript check and tests
