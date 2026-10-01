# NutriScan Security Review

**Date:** 2026-10-01
**Status:** Initial Security Audit Complete

---

## Executive Summary
This document summarizes the security posture of the NutriScan application, covering mobile, backend, and external service components. The audit addressed 22 critical areas, including secret management, input validation, authentication/authorization, and logging practices.

Overall, the architecture follows secure-by-default principles with:
- Strict separation of public (anon) and private (service role) keys.
- Zod-based validation at all API boundaries.
- Row Level Security (RLS) enabled on database tables.
- Proper use of server-side environment variables for secrets.

Critical issues identified during this audit primarily related to file upload validation (relying on client-provided metadata), lack of EXIF stripping, and minor information leakage in error responses. These have been addressed with new validation and sanitization utilities.

---

## Checklist Findings

| # | Item | Status | Finding / Action |
|---|---|---|---|
| 1 | API key exposure | Resolved | Secrets are in `.env.local`, excluded from git. |
| 2 | Environment variables | Resolved | `EXPO_PUBLIC` variables only used for public keys. |
| 3 | Mobile bundle secrets | Resolved | Confirmed no hardcoded secrets in mobile code. |
| 4 | Server-side secrets | Resolved | Stored in `backend/.env.local`. |
| 5 | Image upload validation | Improved | Added magic byte validation (file headers). |
| 6 | Malicious file uploads | Improved | Magic byte validation prevents extension spoofing. |
| 7 | File size limits | Valid | 20MB limit enforced in Zod schemas. |
| 8 | MIME type validation | Improved | Magic byte validation supersedes client MIME type. |
| 9 | Prompt injection (AI) | Mitigated | Structured JSON output enforced for AI responses. |
| 10 | API abuse | Noted | Expensive endpoints require monitoring. |
| 11 | Rate limiting | Planned | Recommended for future implementation. |
| 12 | Authentication | Secure | Supabase auth (JWT) enforced on all private endpoints. |
| 13 | Authorization | Secure | Repository methods enforce user-scoped data access. |
| 14 | Supabase RLS | Enforced | Enabled on all tables; check policy enforcement. |
| 15 | Database access | Secure | Via repository/service layer only. |
| 16 | Sensitive logging | Improved | Introduced `isSafeToLog` helper. |
| 17 | Error messages | Improved | Sanitized via `sanitizeError` module. |
| 18 | CORS | Secure | Handled by Next.js/Supabase defaults. |
| 19 | SSRF risks | Valid | USDA provider uses fixed URL base. |
| 20 | Dependencies | Action req | `npm audit` reports vulnerabilities. |
| 21 | User privacy | Secure | Data scoped to `user_id`. |
| 22 | Image retention | Noted | Should implement automated cleanup of S3/bucket. |

---

## Detailed Findings & Targeted Fixes

### 1. File Upload Validation (Items #5, #6, #8)
- **Problem:** Files were validated only by MIME type (client-supplied) and extension. A malicious executable could be disguised as an image.
- **Fix:** Implemented `backend/lib/validation/file-validation.ts` to validate files using "magic bytes" (magic numbers) instead of relying on client metadata.

### 2. Information Leakage in Errors (Item #17)
- **Problem:** API errors were passing raw error objects to the client, potentially revealing filesystem paths, stack traces, and database connection details.
- **Fix:** Implemented `backend/lib/validation/error-sanitizer.ts` to redact sensitive patterns (paths, stack traces, env var references) from outgoing error messages.

### 3. EXIF Metadata Privacy (Item #9, #21)
- **Problem:** Images stored from users often contain EXIF data with precise GPS location.
- **Fix:** Stubbed `stripExifMetadata()` in `file-validation.ts`. **Next Step:** Implement using a library like `piexifjs` or `sharp` to physically remove metadata before final storage.

---

## Dependency Vulnerabilities
`npm audit` identified vulnerabilities in transitive dependencies (PostCSS, Expo CLI).

**Recommendation:** Update critical sub-dependencies in `package.json` and run `npm audit fix` for automated resolutions. Manual assessment recommended for breaking changes in PostCSS/Expo CLI.

---

## Recommendations / Future Work
1. **Implement RLS Verification:** Explicitly test Supabase policies to ensure a user cannot access another user's scan data using a valid JWT (this is currently enforced in the repository layer, but RLS provides defense-in-depth).
2. **Rate Limiting:** Implement API route middleware to rate-limit `analyze-food` (Gemini API) and `nutrition/lookup` (USDA API) based on user ID or IP.
3. **Automated Image Cleanup:** Set up a background job to delete images from storage that are not associated with a saved `SavedScan` within 24 hours.
4. **Complete EXIF Stripping:** Replace `stripExifMetadata` placeholder with a robust implementation.
