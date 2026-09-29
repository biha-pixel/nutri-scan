---
name: security-review
description: Use when reviewing code for security issues, adding authentication or authorization, handling secrets, processing file uploads, configuring Supabase RLS, or when any change touches security-sensitive areas (API keys, user data, file handling, network requests).
---

# Security Review Guide

Continuously check this project for security problems. Explain every issue in beginner-friendly language and fix issues when appropriate.

## Secret Management
- **Never expose secrets in mobile client code.** (Gemini, USDA, Supabase service roles).
- Server secrets go in environment variables (`.env` files, listed in `.gitignore`).
- **Supabase anon key** is public; fine for the client with RLS.
- **Never use client-side env vars** (`EXPO_PUBLIC_`) for secrets.

## Image Upload Validation
- Validate MIME type from file header (magic bytes), not extension.
- Limit file size.
- Strip EXIF metadata before storage (contains GPS coordinates).
- Generate unique UUID filenames server-side, never use user-supplied names.

## Authentication and Authorization
- **Authentication:** Supabase Auth (JWT tokens).
- **Authorization:** Validate JWTs on every backend request.
- Ensure users only access their own data.

## Supabase Row Level Security (RLS)
- **Enable RLS on every table.**
- Ensure policies restrict rows to `auth.uid() = user_id`.
- Test RLS policies (try to access data as another user).

## Logging
- **Never log secrets.**
- **Never log full request/response bodies** (user data).
- Log errors, request IDs, timestamps for debugging.

## API Abuse Prevention
- **Rate limiting** on scan endpoints (Gemini API costs money per call).
- Validate all input with **Zod** on the server side.

## Security Review Checklist
- [ ] No secrets in client-side code or git history
- [ ] Environment variables used for all server secrets
- [ ] `.env` files in `.gitignore`
- [ ] Image uploads validated (type, size, malicious content, strip EXIF)
- [ ] User input validated on the server with Zod
- [ ] Authentication checked on protected endpoints
- [ ] Authorization verified (users access own data only)
- [ ] RLS enabled on all Supabase tables
- [ ] No sensitive data in logs
- [ ] Rate limiting on expensive or sensitive endpoints
- [ ] Dependencies audited (`npm audit`)
