---
name: security-review
description: Use when reviewing code for security issues, adding authentication or authorization, handling secrets, processing file uploads, configuring Supabase RLS, or when any change touches security-sensitive areas (API keys, user data, file handling, network requests).
---

# Security Review Guide

Continuously check this project for security problems. Explain every issue in beginner-friendly language and fix issues when appropriate.

## Secret Management

### Rules
- **Never expose secrets in mobile code.** API keys for Gemini, USDA, Supabase service roles, or any other secret must never appear in the React Native / Expo codebase. They do not belong in:
  - Source code files
  - `app.json` / `app.config.js` (values that end up in the JS bundle)
  - Git history
  - Client-side environment variables (anything prefixed with `EXPO_PUBLIC_`)
- **Server secrets go in environment variables** on the server, loaded from `.env` files that are listed in `.gitignore`.
- **Supabase anon key** is the one exception — it is designed to be public and is used with Row Level Security. Still, never expose the Supabase **service role key** to the client.

### How to Explain This to the User
> *Think of an API key like a house key. Your server is inside your house — safe. Your mobile app is a copy of your app that runs on a stranger's phone. If you put the house key in the app, anyone who downloads it can find the key and walk into your house.*

## Image Upload Validation

When users upload food images:

- **Validate file type.** Accept only image MIME types (`image/jpeg`, `image/png`, `image/webp`). Check the actual file header (magic bytes), not just the file extension or the `Content-Type` header — those can be faked.
- **Limit file size.** Set a maximum (e.g., 10 MB). Reject anything larger before processing.
- **Consider malicious files.** An uploaded "image" could be:
  - An executable disguised as an image.
  - An image with embedded scripts (polyglot files).
  - An extremely large image designed to exhaust server memory when processed (decompression bomb).
- **Strip EXIF metadata** before storing images — EXIF can contain GPS coordinates, device info, and other private data.
- **Do not use user-supplied filenames** for storage. Generate unique filenames server-side (e.g., UUIDs).

## Authentication and Authorization

- **Authentication** (who are you?) — verify the user's identity via Supabase Auth (JWT tokens).
- **Authorization** (what are you allowed to do?) — verify the user has permission for the specific action.
- Validate JWT tokens on every API request to the server. Do not trust client-side claims.
- Users must only access their own data. Never return another user's scan history, saved foods, or profile.

## Supabase Row Level Security (RLS)

- **Enable RLS on every table.** A table without RLS in Supabase is accessible to anyone with the anon key.
- Write policies that restrict rows to `auth.uid() = user_id`.
- Test RLS policies — try accessing data as a different user and verify it is denied.
- Explain RLS to the user:
  > *Row Level Security is like a rule on each row of a database table that says "only the person who owns this row can see or change it." Even if someone gets your public API key, they can only access their own data.*

## Logging

- **Never log secrets** — API keys, tokens, passwords.
- **Never log full request/response bodies** that might contain user data in production.
- **Do log** — error types, request IDs, timestamps, and enough context to debug without exposing private data.
- Be cautious with AI model responses in logs — they might contain unexpected content.

## Dependency Security

- Regularly check for known vulnerabilities: `npm audit`.
- Do not install packages with known critical vulnerabilities without a clear justification and mitigation plan.
- Prefer well-maintained packages with active security response.
- Review what a package does before installing it — especially packages that request network access or filesystem access.

## API Abuse Prevention

- **Rate limiting** — protect your server endpoints from being called too frequently. Start with a simple per-IP or per-user rate limit.
- **Input validation** — validate and sanitize all input on the server side. Never trust input from the mobile app.
- **Cost exposure** — the Gemini API costs money per call. An attacker who can trigger unlimited food scans through your server can run up your bill. Rate-limit the scan endpoint per user.
- Explain this to the user:
  > *Your server sits between the user and paid APIs like Gemini. If someone figures out how to call your server's scan endpoint 10,000 times, you pay for 10,000 Gemini API calls. Rate limiting prevents this.*

## Security Review Checklist

When reviewing code changes, check:

- [ ] No secrets in client-side code or git history
- [ ] Environment variables used for all server secrets
- [ ] `.env` files in `.gitignore`
- [ ] Image uploads validated (type, size, malicious content)
- [ ] User input validated on the server
- [ ] Authentication checked on protected endpoints
- [ ] Authorization verified (user can only access own data)
- [ ] RLS enabled on all Supabase tables
- [ ] No sensitive data in logs
- [ ] Rate limiting on expensive or sensitive endpoints
- [ ] Dependencies audited for known vulnerabilities

## When to Fix vs. When to Flag

- **Fix immediately:** secrets in code, missing authentication, missing RLS, obvious injection vulnerabilities.
- **Flag and explain:** potential issues that need discussion (rate limit thresholds, caching strategies for security-sensitive data, dependency upgrade decisions).
